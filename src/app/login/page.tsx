import { login } from '../../actions/auth';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const message =
    params.erro === 'banco' ? 'Banco de dados indisponível. Verifique a conexão e tente novamente.' :
    params.erro === 'sessao' ? 'Sua sessão não foi encontrada ou expirou. Entre novamente.' :
    params.erro ? 'E-mail ou senha inválidos.' : null;
  return <main className="login-page"><section className="login-card">
    <div className="brand login-brand"><span className="brand-mark">B</span><div><strong>BRASAUTO</strong><small>Gestão de Compras</small></div></div>
    <div><span className="eyebrow">Acesso interno</span><h1>Entrar no sistema</h1><p>Use seu usuário individual. As ações ficam registradas na trilha de auditoria.</p></div>
    {message && <div className="notice notice-warn">{message}</div>}
    <form action={login} className="login-form"><label className="field"><span>E-mail</span><input name="email" type="email" autoComplete="email" required /></label><label className="field"><span>Senha</span><input name="password" type="password" autoComplete="current-password" required /></label><button className="button" type="submit">Entrar</button></form>
    <small className="muted">Ambiente corporativo · acesso sujeito às permissões do perfil.</small>
  </section></main>;
}
