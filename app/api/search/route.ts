import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

type EntityType = "user" | "report" | "incident" | "request";

function parseQuery(q: string): { text: string; type?: EntityType; from?: string; status?: string } {
  const parts = q.trim().split(/\s+/);
  let type: EntityType | undefined;
  let from: string | undefined;
  let status: string | undefined;
  const rest: string[] = [];

  for (const p of parts) {
    if (p.startsWith("type:")) {
      const raw = p.slice("type:".length).toLowerCase();
      const v =
        raw === "users" ? "user" :
        raw === "reports" ? "report" :
        raw === "incidents" ? "incident" :
        raw === "requests" ? "request" :
        raw;

      if (v === "user" || v === "report" || v === "incident" || v === "request") type = v;
      continue;
    }

    if (p.startsWith("from:")) {
      from = p.slice("from:".length).trim();
      continue;
    }

    if (p.startsWith("status:")) {
      status = p.slice("status:".length).trim().toLowerCase();
      continue;
    }

    rest.push(p);
  }

  return { text: rest.join(" "), type, from, status };
}

function splitOrTerms(s: string) {
  return s
    .split(/[\/|]/g) // 支持 a/b 或 a|b
    .map((x) => x.trim())
    .filter(Boolean);
}

const pat = (s: string) => `%${s}%`;
const buildIlikeOr = (col: string, terms: string[]) =>
  terms.map((t) => `${col}.ilike.${pat(t)}`).join(",");

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ results: [] }, { status: 401 });

  const parsed = parseQuery(q);
  const term = parsed.text.trim();
  const terms = splitOrTerms(term);
  const termsLower = terms.map((t) => t.toLowerCase());

  const results: any[] = [];

  // ✅ 1) from:xxx —— 保留：只负责跳转 profile（不影响其它功能）
  if (parsed.from) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", parsed.from)
      .limit(1);

    if (data && data.length > 0) {
      results.push({
        id: data[0].id,
        type: "user",
        title: data[0].username,
        description: "View profile",
        url: `/profile/${data[0].username}`,
      });
    }
    return NextResponse.json({ results });
  }

  // ✅ 2) REPORTS —— 保留：按 description 搜；新增：type:report 无关键词列出最近 5 条
  if (!parsed.type || parsed.type === "report") {
    let rq = supabase
      .from("reports")
      .select("id, description, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (terms.length > 0) {
      rq = rq.or(buildIlikeOr("description", terms));
    } else if (parsed.type === "report") {
      // ✅ 新增：type-only 列表
      // 不加任何过滤，直接 recent 5
    } else {
      // 没指定 type 且没关键词：避免返回一堆
      rq = rq.limit(0);
    }

    if (parsed.status) rq = rq.eq("status", parsed.status); // enum 用 eq 更稳

    const { data } = await rq;

    (data ?? []).forEach((r) =>
      results.push({
        id: r.id,
        type: "report",
        title: r.description ?? "Report",
        description: r.status ? `status: ${r.status}` : null,
        url: `/report/${r.id}`,
      })
    );
  }

  // ✅ 3) REQUESTS —— 保留：按 resource_type 搜；新增：type:request 无关键词列出最近 5 条
  if (!parsed.type || parsed.type === "request") {
    let qq = supabase
      .from("requests")
      .select("id, status, resource_type, quantity, description, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (termsLower.length > 0) {
      // 保留：request “type” 搜索（resource_type enum）
      qq = qq.in("resource_type", termsLower);
    } else if (parsed.type === "request") {
      // ✅ 新增：type-only 列表
      // 不加过滤，直接 recent 5
    } else {
      qq = qq.limit(0);
    }

    if (parsed.status) qq = qq.eq("status", parsed.status); // enum 用 eq

    const { data } = await qq;

    (data ?? []).forEach((r) =>
      results.push({
        id: r.id,
        type: "request",
        title: r.description ? `Request: ${r.description}` : `Request ${r.id}`,
        description: [
          r.status ? `status: ${r.status}` : null,
          r.resource_type ? `resource: ${r.resource_type}` : null,
          r.quantity != null ? `qty: ${r.quantity}` : null,
        ]
          .filter(Boolean)
          .join(" • ") || null,
        url: `/request/${r.id}`,
      })
    );
  }

  return NextResponse.json({ results: results.slice(0, 12) });
}