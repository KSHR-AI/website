import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const envUrl = new URL("../.env.local", import.meta.url);

  if (!existsSync(envUrl)) {
    return;
  }

  const lines = readFileSync(envUrl, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...rest] = trimmed.split("=");
    process.env[key] ??= rest.join("=");
  }
}

loadLocalEnv();

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing env vars: ${missing.join(", ")}`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const anonymous = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const suffix = randomUUID().slice(0, 8);
const email = `codex-smoke-${suffix}@kshr.ai`;
const password = `Smoke-${randomUUID()}-Password1!`;
const storagePath = `smoke/${suffix}.txt`;

let userId;
let companyId;
let contactId;
let fundId;
let roundId;
let investmentId;

async function assertNoError(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data;
}

async function cleanup() {
  await anonymous.auth.signOut();

  if (storagePath) {
    await admin.storage.from("internal-documents").remove([storagePath]);
  }

  if (companyId) {
    await admin.from("documents").delete().eq("company_id", companyId);
    await admin.from("portfolio_metrics").delete().eq("company_id", companyId);
    await admin.from("investments").delete().eq("company_id", companyId);
    await admin.from("rounds").delete().eq("company_id", companyId);
    await admin.from("tasks").delete().eq("entity_type", "company").eq("entity_id", companyId);
    await admin.from("notes").delete().eq("entity_type", "company").eq("entity_id", companyId);
    await admin.from("interactions").delete().eq("company_id", companyId);
    await admin.from("company_contacts").delete().eq("company_id", companyId);
    await admin.from("activity_log").delete().eq("entity_type", "company").eq("entity_id", companyId);
    await admin.from("companies").delete().eq("id", companyId);
  }

  if (contactId) {
    await admin.from("contacts").delete().eq("id", contactId);
  }

  if (fundId) {
    await admin.from("funds").delete().eq("id", fundId);
  }

  if (investmentId) {
    await admin.from("activity_log").delete().eq("entity_type", "investment").eq("entity_id", investmentId);
  }

  if (roundId) {
    await admin.from("activity_log").delete().eq("entity_type", "round").eq("entity_id", roundId);
  }

  if (userId) {
    await admin.from("app_users").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
}

try {
  const createdUser = await assertNoError(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        source: "codex-smoke-test"
      }
    }),
    "create auth user"
  );
  userId = createdUser.user.id;

  const anonWrite = await anonymous.from("companies").insert({ name: "Anonymous should fail" });
  if (!anonWrite.error) {
    throw new Error("anonymous write unexpectedly succeeded");
  }

  await assertNoError(
    await admin.from("app_users").insert({
      id: userId,
      email,
      role: "admin",
      status: "active"
    }),
    "create app user"
  );

  const signedIn = await assertNoError(await anonymous.auth.signInWithPassword({ email, password }), "sign in");
  const accessToken = signedIn.session.access_token;

  const authed = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });

  const company = await assertNoError(
    await authed
      .from("companies")
      .insert({
        name: `Smoke Company ${suffix}`,
        stage: "diligence",
        description: "Supabase smoke test company",
        created_by: userId
      })
      .select("id")
      .single(),
    "create company"
  );
  companyId = company.id;

  const contact = await assertNoError(
    await authed
      .from("contacts")
      .insert({
        first_name: "Smoke",
        last_name: "Founder",
        email,
        created_by: userId
      })
      .select("id")
      .single(),
    "create contact"
  );
  contactId = contact.id;

  await assertNoError(
    await authed.from("company_contacts").insert({
      company_id: companyId,
      contact_id: contactId,
      relationship: "Founder",
      is_primary: true
    }),
    "link contact"
  );

  await assertNoError(
    await authed.from("interactions").insert({
      company_id: companyId,
      contact_id: contactId,
      kind: "meeting",
      summary: "Smoke test meeting",
      created_by: userId
    }),
    "create interaction"
  );

  await assertNoError(
    await authed.from("notes").insert({
      entity_type: "company",
      entity_id: companyId,
      body: "Smoke test note",
      created_by: userId
    }),
    "create note"
  );

  await assertNoError(
    await authed.from("tasks").insert({
      title: "Smoke follow-up",
      entity_type: "company",
      entity_id: companyId,
      owner_id: userId,
      created_by: userId
    }),
    "create task"
  );

  const fund = await assertNoError(
    await authed
      .from("funds")
      .insert({
        name: `Smoke Fund ${suffix}`,
        vintage_year: 2026,
        created_by: userId
      })
      .select("id")
      .single(),
    "create fund"
  );
  fundId = fund.id;

  const round = await assertNoError(
    await authed
      .from("rounds")
      .insert({
        company_id: companyId,
        name: "Seed",
        round_type: "priced",
        amount_raised: 1000000,
        created_by: userId
      })
      .select("id")
      .single(),
    "create round"
  );
  roundId = round.id;

  const investment = await assertNoError(
    await authed
      .from("investments")
      .insert({
        company_id: companyId,
        fund_id: fundId,
        round_id: roundId,
        amount: 250000,
        ownership_percent: 5,
        created_by: userId
      })
      .select("id")
      .single(),
    "create investment"
  );
  investmentId = investment.id;

  await assertNoError(
    await authed.from("portfolio_metrics").insert({
      company_id: companyId,
      metric_name: "ARR",
      metric_value: 100000,
      created_by: userId
    }),
    "create metric"
  );

  await assertNoError(
    await authed.from("documents").insert({
      company_id: companyId,
      title: "Smoke memo",
      storage_path: storagePath,
      mime_type: "text/plain",
      created_by: userId
    }),
    "create document record"
  );

  await assertNoError(
    await authed.storage.from("internal-documents").upload(storagePath, new Blob(["smoke"]), {
      contentType: "text/plain"
    }),
    "upload internal document"
  );

  const readback = await assertNoError(
    await authed.from("companies").select("id,name,stage").eq("id", companyId).single(),
    "read company"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        anonymousWriteBlocked: true,
        authUserCreated: true,
        appUserCreated: true,
        rlsCrudPassed: true,
        storagePassed: true,
        readbackStage: readback.stage
      },
      null,
      2
    )
  );
} finally {
  await cleanup();
}
