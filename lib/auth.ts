export const AUTH_COOKIE = "dp_session";

/** 쿠키에 비밀번호 자체를 넣지 않으려고 해시를 쓴다. 비밀번호를 바꾸면 기존 로그인이 풀린다. */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`daily-picks:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
