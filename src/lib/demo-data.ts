export const requests = [
  { code:'SC-2026-0004', unit:'Unidade Norte', item:'Material de manutenção', requester:'Manutenção', urgency:'Alta', status:'EM COTAÇÃO', date:'12/08/2026' },
  { code:'SC-2026-0003', unit:'Unidade Sul', item:'Material de escritório', requester:'Administrativo', urgency:'Média', status:'AG. APROVAÇÃO', date:'10/08/2026' },
  { code:'SC-2026-0002', unit:'Unidade Centro', item:'Equipamento de proteção', requester:'Oficina', urgency:'Média', status:'PEDIDO REALIZADO', date:'07/08/2026' },
  { code:'SC-2026-0001', unit:'Unidade Leste', item:'Serviço de locação', requester:'Manutenção', urgency:'Alta', status:'AG. ENTREGA', date:'07/08/2026' },
];

export const suppliers = [
  { name:'Fornecedor Alfa', city:'Cidade Exemplo/MG', category:'EPI', payment:'Faturado 30 dias', score:'Preferencial', active:true },
  { name:'Fornecedor Beta', city:'Cidade Exemplo/MG', category:'Locação de equipamentos', payment:'Boleto 30 dias', score:'Preferencial', active:true },
  { name:'Fornecedor Gama', city:'Cidade Exemplo/MG', category:'Materiais / manutenção', payment:'Faturado', score:'Homologado', active:true },
  { name:'Fornecedor Delta', city:'Cidade Exemplo/MG', category:'Diversos', payment:'PIX antecipado', score:'A avaliar', active:true },
];

export const quotationExample = [
  { supplier:'Fornecedor A', total:1000, payment:'PIX antecipado', rank:8, delivery:'2 dias' },
  { supplier:'Fornecedor B', total:1030, payment:'Boleto 30 dias', rank:4, delivery:'3 dias' },
  { supplier:'Fornecedor C', total:1018, payment:'Cartão de crédito', rank:6, delivery:'5 dias' },
];

export const orders = [
  { code:'PC-2026-0002', request:'SC-2026-0002', supplier:'Fornecedor Alfa', unit:'Unidade Centro', total:1840, payment:'Boleto 30 dias', expected:'18/08/2026', status:'AGUARDANDO_ENTREGA' },
  { code:'PC-2026-0001', request:'SC-2026-0001', supplier:'Fornecedor Beta', unit:'Unidade Leste', total:1800, payment:'Boleto 30 dias', expected:'14/08/2026', status:'RECEBIDO_PARCIALMENTE' },
];

export const receipts = [
  { order:'PC-2026-0001', item:'Serviço de locação', received:'0,5 de 1 diária', date:'12/08/2026', responsible:'Compras', status:'PARCIAL' },
];

export const installments = [
  { order:'PC-2026-0002', supplier:'Fornecedor Alfa', installment:'1/1', amount:1840, due:'11/09/2026', status:'PREVISTA', postReceipt:false },
  { order:'PC-2026-0001', supplier:'Fornecedor Beta', installment:'1/1', amount:1800, due:'—', status:'AGUARDANDO RECEBIMENTO', postReceipt:true },
];
