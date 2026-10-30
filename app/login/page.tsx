export const metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = !!process.env.SITE_PASSWORD;
  return (
    <div className="mx-auto mt-16 max-w-sm rounded-xl border border-line bg-surface p-6">
      <h1 className="text-lg font-bold">비밀번호를 입력하세요</h1>
      {configured ? (
        <form action="/api/login" method="post" className="mt-4 grid gap-3">
          <input
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            aria-label="비밀번호"
            className="rounded-lg border border-line bg-bg px-3 py-2.5 text-base outline-none focus:border-ink-3"
          />
          {error ? <p className="text-sm text-up">비밀번호가 맞지 않습니다.</p> : null}
          <button type="submit" className="rounded-lg bg-accent px-3 py-2.5 font-medium text-bg">
            들어가기
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          아직 비밀번호가 설정되지 않았습니다. Vercel 프로젝트의 Settings → Environment Variables에 <code>SITE_PASSWORD</code>를 추가하고 다시 배포하세요.
        </p>
      )}
    </div>
  );
}
