import Link from 'next/link';
export default function Page(){return <main className="login-page"><section className="login-card"><span className="eyebrow">Acesso restrito</span><h1>Sem permissão</h1><p>Seu perfil não possui autorização para executar ou visualizar esta função.</p><Link className="button" href="/">Voltar ao dashboard</Link></section></main>}
