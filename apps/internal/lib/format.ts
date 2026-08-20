export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "No date";
  }

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatPercentage(
  value: number | null | undefined,
  maximumFractionDigits = 1,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits,
  }).format(value);
}

export function formatMultiple(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value)}×`;
}

export function formatOwnership(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const ownership = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(ownership)) {
    return "—";
  }

  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(ownership)}%`;
}

export function formatMoney(
  value: number | string | null | undefined,
  currency = "USD",
) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function toDateInputValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

export function toDateTimeInputValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 16);
}

export function oneRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function formNumber(formData: FormData, key: string) {
  const value = formString(formData, key);
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
