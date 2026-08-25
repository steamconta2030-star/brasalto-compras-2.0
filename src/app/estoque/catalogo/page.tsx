import Link from 'next/link';
import { Card, PageHeader } from '../../../components/ui';
import { requirePermission } from '../../../lib/auth';

const groups = [
 {title:'Copa e limpeza', items:['Pó de café','Açúcar','Copo descartável','Papel higiênico','Papel toalha','Sabonete','Detergente','Desinfetante','Saco de lixo','Limpa-vidros']},
 {title:'Escritório', items:['Papel A4 / Chamex','Caneta esferográfica','Lápis','Marca-texto','Post-it','Grampos','Clips','Fita adesiva','Envelopes','Pastas']},
];
export default async function Page(){
 await requirePermission('INVENTORY_MANAGE');
 return <div className="page"><PageHeader title="Base de materiais recorrentes" subtitle="Referência para iniciar o inventário das unidades sem obrigar todas a terem os mesmos itens." action={<Link className="button" href="/estoque/novo">+ Cadastrar item</Link>}/>
 <div className="kpi-grid">{groups.map(g=><Card key={g.title}><h2>{g.title}</h2><p>{g.items.join(' · ')}</p></Card>)}</div>
 <Card className="section-gap"><h2>Como usar</h2><p>Cadastre apenas o que realmente existe em cada unidade. Para materiais de consumo contínuo, use consumo médio. Para itens esporádicos, use estoque mínimo. Marque como crítico somente o que não pode faltar.</p></Card>
 </div>
}