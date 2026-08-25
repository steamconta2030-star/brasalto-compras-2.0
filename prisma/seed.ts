import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';
const prisma = new PrismaClient();

async function main() {
  const unitsData = [
    ['UNIDADE_A','Unidade A'],['UNIDADE_B','Unidade B'],['UNIDADE_C','Unidade C'],
  ] as const;
  const units = [];
  for (const [code,name] of unitsData) units.push(await prisma.unit.upsert({where:{code},update:{name},create:{code,name}}));
  const unit = units[0];

  const permissions = [
    ['REQUEST_CREATE','Criar solicitações'],['QUOTATION_MANAGE','Gerenciar cotações'],['SUPPLIER_MANAGE','Gerenciar fornecedores'],
    ['APPROVAL_DECIDE','Aprovar ou reprovar compras'],['PURCHASE_ORDER_CREATE','Emitir pedidos de compra'],['RECEIPT_REGISTER','Registrar recebimentos'],
    ['FINANCE_VIEW','Visualizar financeiro'],['INVENTORY_MANAGE','Gerenciar estoque e uso/consumo'],['AUDIT_VIEW','Visualizar auditoria'],['USER_MANAGE','Gerenciar usuários'],['ADMIN_ALL','Acesso administrativo total'],
  ] as const;
  const permissionMap = new Map<string,string>();
  for (const [key,description] of permissions) { const p = await prisma.permission.upsert({where:{key},update:{description},create:{key,description}}); permissionMap.set(key,p.id); }

  const roleSpecs: Record<string,string[]> = {
    SOLICITANTE:['REQUEST_CREATE'],
    COMPRAS:['REQUEST_CREATE','QUOTATION_MANAGE','SUPPLIER_MANAGE','PURCHASE_ORDER_CREATE','INVENTORY_MANAGE'],
    APROVADOR:['APPROVAL_DECIDE'],
    RECEBIMENTO:['RECEIPT_REGISTER','INVENTORY_MANAGE'],
    FINANCEIRO:['FINANCE_VIEW'],
    ADMIN:['ADMIN_ALL','REQUEST_CREATE','QUOTATION_MANAGE','SUPPLIER_MANAGE','APPROVAL_DECIDE','PURCHASE_ORDER_CREATE','RECEIPT_REGISTER','FINANCE_VIEW','INVENTORY_MANAGE','AUDIT_VIEW','USER_MANAGE'],
  };
  const roleMap = new Map<string,string>();
  for (const [name,keys] of Object.entries(roleSpecs)) {
    const role = await prisma.role.upsert({where:{name},update:{},create:{name}}); roleMap.set(name,role.id);
    await prisma.rolePermission.deleteMany({where:{roleId:role.id}});
    await prisma.rolePermission.createMany({data:keys.map(key=>({roleId:role.id,permissionId:permissionMap.get(key)!})),skipDuplicates:true});
  }

  const terms = [
    ['Faturado após recebimento',1,true,[]],['Boleto 30/60/90',2,true,[30,60,90]],['Boleto 30/60',3,true,[30,60]],['Boleto 30 dias',4,true,[30]],['Boleto 15 dias',5,true,[15]],['Cartão de crédito',6,false,[]],['PIX após recebimento',7,true,[0]],['PIX antecipado',8,false,[]]
  ] as const;
  for (const [name,rank,postReceipt,days] of terms) await prisma.paymentTerm.upsert({where:{name},update:{rank,postReceipt,days:[...days]},create:{name,rank,postReceipt,days:[...days]}});

  const categories = ['EPI','Materiais e manutenção','Uso e consumo','Limpeza e higiene','Locação de equipamentos','Obras','Mobiliário e comunicação visual'];
  for (const name of categories) await prisma.category.upsert({where:{name},update:{},create:{name}});
  const category = await prisma.category.findUniqueOrThrow({where:{name:'Materiais e manutenção'}});
  for (const name of ['Compras','Oficina','Administrativo','Obras']) await prisma.department.upsert({where:{unitId_name:{unitId:unit.id,name}},update:{},create:{unitId:unit.id,name}});

  const requiredSeedPassword = (name: 'SEED_ADMIN_PASSWORD' | 'SEED_BUYER_PASSWORD' | 'SEED_APPROVER_PASSWORD') => {
    const value = process.env[name];
    if (!value || value.length < 12) {
      throw new Error(`${name} deve ser definida com pelo menos 12 caracteres antes de executar o seed.`);
    }
    return value;
  };
  const adminPassword = requiredSeedPassword('SEED_ADMIN_PASSWORD');
  const buyerPassword = requiredSeedPassword('SEED_BUYER_PASSWORD');
  const approverPassword = requiredSeedPassword('SEED_APPROVER_PASSWORD');
  const admin = await prisma.user.upsert({
    where:{email:'admin@example.invalid'},
    update:{name:'Administrador',unitId:unit.id,passwordHash:hashPassword(adminPassword),active:true},
    create:{name:'Administrador',email:'admin@example.invalid',passwordHash:hashPassword(adminPassword),unitId:unit.id},
  });
  await prisma.userRole.deleteMany({where:{userId:admin.id}});
  await prisma.userRole.create({data:{userId:admin.id,roleId:roleMap.get('ADMIN')!}});

  const buyer = await prisma.user.upsert({
    where:{email:'compras@example.invalid'},
    update:{name:'Usuário de Compras',unitId:unit.id,passwordHash:hashPassword(buyerPassword),active:true},
    create:{name:'Usuário de Compras',email:'compras@example.invalid',passwordHash:hashPassword(buyerPassword),unitId:unit.id},
  });
  await prisma.userRole.deleteMany({where:{userId:buyer.id}});
  await prisma.userRole.create({data:{userId:buyer.id,roleId:roleMap.get('COMPRAS')!}});

  const approver = await prisma.user.upsert({
    where:{email:'aprovador@example.invalid'},
    update:{name:'Usuário Aprovador',unitId:unit.id,passwordHash:hashPassword(approverPassword),active:true},
    create:{name:'Usuário Aprovador',email:'aprovador@example.invalid',passwordHash:hashPassword(approverPassword),unitId:unit.id},
  });
  await prisma.userRole.deleteMany({where:{userId:approver.id}});
  await prisma.userRole.create({data:{userId:approver.id,roleId:roleMap.get('APROVADOR')!}});

  const approvalRoleId = roleMap.get('APROVADOR')!;
  await prisma.approvalRule.deleteMany({where:{name:{startsWith:'Regra demonstrativa'}}});
  await prisma.approvalRule.createMany({data:[
    {name:'Regra demonstrativa · faixa inicial',unitId:null,roleId:approvalRoleId,minAmount:0,maxAmount:5000,priority:10},
    {name:'Regra demonstrativa · faixa superior',unitId:null,roleId:approvalRoleId,minAmount:5000.01,maxAmount:null,priority:20},
    {name:'Regra demonstrativa · divergência',unitId:null,roleId:approvalRoleId,minAmount:0,maxAmount:null,requireOnDivergence:true,priority:1},
  ]});

  const boleto30 = await prisma.paymentTerm.findUniqueOrThrow({where:{name:'Boleto 30 dias'}});
  const supplierA = await prisma.supplier.upsert({where:{document:'00.000.000/0001-01'},update:{defaultPaymentTermId:boleto30.id},create:{legalName:'Fornecedor A Demonstração',tradeName:'Fornecedor A',document:'00.000.000/0001-01',city:'Cidade Exemplo',state:'MG',defaultPaymentTermId:boleto30.id}});
  const supplierB = await prisma.supplier.upsert({where:{document:'00.000.000/0001-02'},update:{defaultPaymentTermId:boleto30.id},create:{legalName:'Fornecedor B Demonstração',tradeName:'Fornecedor B',document:'00.000.000/0001-02',city:'Cidade Exemplo',state:'MG',defaultPaymentTermId:boleto30.id}});
  await prisma.supplierUnit.createMany({data:[{supplierId:supplierA.id,unitId:unit.id},{supplierId:supplierB.id,unitId:unit.id}],skipDuplicates:true});
  await prisma.supplierCategory.createMany({data:[{supplierId:supplierA.id,categoryId:category.id},{supplierId:supplierB.id,categoryId:category.id}],skipDuplicates:true});
  const request = await prisma.purchaseRequest.upsert({where:{code:'SC-2026-0001'},update:{},create:{code:'SC-2026-0001',year:2026,unitId:unit.id,requesterId:buyer.id,categoryId:category.id,urgency:'MEDIA',description:'Solicitação de demonstração para fluxo de cotação',status:'AGUARDANDO_COTACAO'}});
  await prisma.purchaseRequestItem.findFirst({where:{requestId:request.id}}) ?? await prisma.purchaseRequestItem.create({data:{requestId:request.id,product:'Item de demonstração',quantity:1,unitOfMeasure:'UN'}});
  console.log('Seed concluído. Usuário admin: admin@example.invalid');
}
main().finally(()=>prisma.$disconnect());
