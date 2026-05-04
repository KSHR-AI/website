"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { formNumber, formString } from "@/lib/format";
import { requireActiveUser } from "@/lib/supabase/server";

async function logActivity(action: string, entityType: string, entityId: string, details = {}) {
  const { supabase, user } = await requireActiveUser();
  await supabase.from("activity_log").insert({
    actor_id: user.id,
    entity_type: entityType,
    entity_id: entityId,
    action,
    details
  });
}

export async function createCompany(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const name = formString(formData, "name");

  if (!name) {
    redirect("/companies?error=company_name_required");
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name,
      website: formString(formData, "website"),
      stage: formString(formData, "stage") ?? "prospect",
      description: formString(formData, "description"),
      founded_year: formNumber(formData, "founded_year"),
      created_by: user.id
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect("/companies?error=create_failed");
  }

  await logActivity("created_company", "company", data.id, { name });
  revalidatePath("/companies");
  redirect(`/companies/${data.id}`);
}

export async function updateCompany(formData: FormData) {
  const { supabase } = await requireActiveUser();
  const id = formString(formData, "id");

  if (!id) {
    redirect("/companies");
  }

  await supabase
    .from("companies")
    .update({
      name: formString(formData, "name"),
      website: formString(formData, "website"),
      stage: formString(formData, "stage"),
      description: formString(formData, "description"),
      founded_year: formNumber(formData, "founded_year")
    })
    .eq("id", id);

  await logActivity("updated_company", "company", id);
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
}

export async function createContact(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const firstName = formString(formData, "first_name");

  if (!firstName) {
    redirect("/contacts?error=contact_name_required");
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      first_name: firstName,
      last_name: formString(formData, "last_name"),
      email: formString(formData, "email"),
      phone: formString(formData, "phone"),
      title: formString(formData, "title"),
      linkedin_url: formString(formData, "linkedin_url"),
      created_by: user.id
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect("/contacts?error=create_failed");
  }

  await logActivity("created_contact", "contact", data.id, { first_name: firstName });
  revalidatePath("/contacts");
}

export async function updateContact(formData: FormData) {
  const { supabase } = await requireActiveUser();
  const id = formString(formData, "id");
  const firstName = formString(formData, "first_name");

  if (!id || !firstName) {
    redirect("/contacts?error=contact_name_required");
  }

  await supabase
    .from("contacts")
    .update({
      first_name: firstName,
      last_name: formString(formData, "last_name"),
      email: formString(formData, "email"),
      phone: formString(formData, "phone"),
      title: formString(formData, "title"),
      linkedin_url: formString(formData, "linkedin_url")
    })
    .eq("id", id);

  await logActivity("updated_contact", "contact", id);
  revalidatePath("/contacts");
}

export async function createCompanyContact(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const companyId = formString(formData, "company_id");
  const firstName = formString(formData, "first_name");

  if (!companyId || !firstName) {
    redirect("/companies");
  }

  const { data } = await supabase
    .from("contacts")
    .insert({
      first_name: firstName,
      last_name: formString(formData, "last_name"),
      email: formString(formData, "email"),
      title: formString(formData, "title"),
      created_by: user.id
    })
    .select("id")
    .single();

  if (data) {
    await supabase.from("company_contacts").insert({
      company_id: companyId,
      contact_id: data.id,
      relationship: formString(formData, "relationship"),
      is_primary: formData.get("is_primary") === "on"
    });
    await logActivity("linked_contact", "company", companyId, { contact_id: data.id });
  }

  revalidatePath(`/companies/${companyId}`);
}

export async function createNote(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const entityType = formString(formData, "entity_type");
  const entityId = formString(formData, "entity_id");
  const body = formString(formData, "body");

  if (!entityType || !entityId || !body) {
    redirect("/");
  }

  await supabase.from("notes").insert({
    entity_type: entityType,
    entity_id: entityId,
    body,
    created_by: user.id
  });

  await logActivity("created_note", entityType, entityId);
  revalidatePath(`/companies/${entityId}`);
}

export async function updateNote(formData: FormData) {
  const { supabase } = await requireActiveUser();
  const id = formString(formData, "id");
  const entityType = formString(formData, "entity_type");
  const entityId = formString(formData, "entity_id");
  const body = formString(formData, "body");

  if (!id || !entityType || !entityId || !body) {
    redirect("/");
  }

  await supabase.from("notes").update({ body }).eq("id", id);
  await logActivity("updated_note", entityType, entityId);

  if (entityType === "company") {
    revalidatePath(`/companies/${entityId}`);
  }
}

export async function createInteraction(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const companyId = formString(formData, "company_id");
  const summary = formString(formData, "summary");

  if (!companyId || !summary) {
    redirect("/companies");
  }

  await supabase.from("interactions").insert({
    company_id: companyId,
    contact_id: formString(formData, "contact_id"),
    kind: formString(formData, "kind") ?? "note",
    occurred_at: formString(formData, "occurred_at") ?? new Date().toISOString(),
    summary,
    notes: formString(formData, "notes"),
    created_by: user.id
  });

  await logActivity("created_interaction", "company", companyId, { summary });
  revalidatePath(`/companies/${companyId}`);
}

export async function updateInteraction(formData: FormData) {
  const { supabase } = await requireActiveUser();
  const id = formString(formData, "id");
  const companyId = formString(formData, "company_id");
  const summary = formString(formData, "summary");

  if (!id || !companyId || !summary) {
    redirect("/companies");
  }

  await supabase
    .from("interactions")
    .update({
      kind: formString(formData, "kind") ?? "note",
      occurred_at: formString(formData, "occurred_at") ?? new Date().toISOString(),
      summary,
      notes: formString(formData, "notes")
    })
    .eq("id", id);

  await logActivity("updated_interaction", "company", companyId, { summary });
  revalidatePath(`/companies/${companyId}`);
}

export async function createTask(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const title = formString(formData, "title");
  const entityId = formString(formData, "entity_id");
  const entityType = entityId ? formString(formData, "entity_type") : null;

  if (!title) {
    redirect("/tasks?error=task_title_required");
  }

  await supabase.from("tasks").insert({
    title,
    status: "open",
    due_at: formString(formData, "due_at"),
    entity_type: entityType,
    entity_id: entityId,
    owner_id: user.id,
    created_by: user.id
  });

  if (entityType && entityId) {
    await logActivity("created_task", entityType, entityId, { title });
    revalidatePath(`/companies/${entityId}`);
  }
  revalidatePath("/tasks");
}

export async function updateTask(formData: FormData) {
  const { supabase } = await requireActiveUser();
  const id = formString(formData, "id");
  const title = formString(formData, "title");
  const entityId = formString(formData, "entity_id");
  const entityType = entityId ? formString(formData, "entity_type") : null;

  if (!id || !title) {
    redirect("/tasks?error=task_title_required");
  }

  await supabase
    .from("tasks")
    .update({
      title,
      status: formString(formData, "status") ?? "open",
      due_at: formString(formData, "due_at"),
      entity_type: entityType,
      entity_id: entityId
    })
    .eq("id", id);

  await logActivity("updated_task", "task", id);
  revalidatePath("/tasks");

  if (entityType === "company" && entityId) {
    revalidatePath(`/companies/${entityId}`);
  }
}

export async function completeTask(formData: FormData) {
  const { supabase } = await requireActiveUser();
  const id = formString(formData, "id");

  if (!id) {
    redirect("/tasks");
  }

  await supabase.from("tasks").update({ status: "done" }).eq("id", id);
  await logActivity("completed_task", "task", id);
  revalidatePath("/tasks");
}

export async function createFund(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const name = formString(formData, "name");

  if (!name) {
    redirect("/portfolio?error=fund_name_required");
  }

  const { data } = await supabase
    .from("funds")
    .insert({
      name,
      vintage_year: formNumber(formData, "vintage_year"),
      description: formString(formData, "description"),
      created_by: user.id
    })
    .select("id")
    .single();

  if (data) {
    await logActivity("created_fund", "fund", data.id, { name });
  }
  revalidatePath("/portfolio");
}

export async function createRound(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const companyId = formString(formData, "company_id");
  const name = formString(formData, "name");

  if (!companyId || !name) {
    redirect("/portfolio?error=round_required");
  }

  const { data } = await supabase
    .from("rounds")
    .insert({
      company_id: companyId,
      name,
      round_type: formString(formData, "round_type"),
      announced_on: formString(formData, "announced_on"),
      amount_raised: formNumber(formData, "amount_raised"),
      pre_money_valuation: formNumber(formData, "pre_money_valuation"),
      post_money_valuation: formNumber(formData, "post_money_valuation"),
      created_by: user.id
    })
    .select("id")
    .single();

  if (data) {
    await logActivity("created_round", "round", data.id, { company_id: companyId });
  }
  revalidatePath("/portfolio");
  revalidatePath(`/companies/${companyId}`);
}

export async function createInvestment(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const companyId = formString(formData, "company_id");

  if (!companyId) {
    redirect("/portfolio?error=investment_company_required");
  }

  const { data } = await supabase
    .from("investments")
    .insert({
      company_id: companyId,
      fund_id: formString(formData, "fund_id"),
      round_id: formString(formData, "round_id"),
      invested_on: formString(formData, "invested_on"),
      amount: formNumber(formData, "amount"),
      ownership_percent: formNumber(formData, "ownership_percent"),
      security: formString(formData, "security"),
      status: formString(formData, "status") ?? "active",
      created_by: user.id
    })
    .select("id")
    .single();

  if (data) {
    await logActivity("created_investment", "investment", data.id, { company_id: companyId });
  }
  revalidatePath("/portfolio");
  revalidatePath(`/companies/${companyId}`);
}

export async function createMetric(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const companyId = formString(formData, "company_id");
  const metricName = formString(formData, "metric_name");

  if (!companyId || !metricName) {
    redirect("/portfolio?error=metric_required");
  }

  await supabase.from("portfolio_metrics").insert({
    company_id: companyId,
    metric_name: metricName,
    metric_value: formNumber(formData, "metric_value"),
    metric_text: formString(formData, "metric_text"),
    measured_on: formString(formData, "measured_on") ?? new Date().toISOString().slice(0, 10),
    created_by: user.id
  });

  await logActivity("created_metric", "company", companyId, { metric_name: metricName });
  revalidatePath("/portfolio");
  revalidatePath(`/companies/${companyId}`);
}

export async function createDocumentRecord(formData: FormData) {
  const { supabase, user } = await requireActiveUser();
  const companyId = formString(formData, "company_id");
  const title = formString(formData, "title");
  const storagePath = formString(formData, "storage_path");

  if (!companyId || !title || !storagePath) {
    redirect("/portfolio?error=document_required");
  }

  await supabase.from("documents").insert({
    company_id: companyId,
    title,
    storage_path: storagePath,
    mime_type: formString(formData, "mime_type"),
    created_by: user.id
  });

  await logActivity("added_document", "company", companyId, { title });
  revalidatePath(`/companies/${companyId}`);
}
