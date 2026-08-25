'use client';

import { useMemo, useState } from 'react';
import { createReplenishmentRequest } from '../actions/inventory';
import { SubmitButton } from './submit-button';

type Row = {
  id:string; name:string; unit:string; category:string; unitOfMeasure:string;
  stock:number; minimum:number; dailyConsumption:number; consumptionSource:string;
  reorderPoint:number; coverageDays:number|null; daysUntilReorder:number|null;
  suggestedQuantity:number; status:string; criticality:string;
  preferredSupplier:string|null;
};

function qty(value:number, unit:string){
  return `${value.toLocaleString('pt-BR',{maximumFractionDigits:3})} ${unit}`;
}
function statusLabel(status:string){
  if(status==='CRITICO') return 'CRÍTICO';
  if(status==='REPOR_AGORA') return 'REPOR AGORA';
  if(status==='ATENCAO') return 'ATENÇÃO';
  if(status==='SEM_BASE') return 'SEM BASE';
  return 'OK';
}

export function InventoryTable({rows,canRequest}:{rows:Row[],canRequest:boolean}){
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('TODOS');
  const [criticality,setCriticality]=useState('TODAS');
  const [unit,setUnit]=useState('TODAS');

  const units=useMemo(
    ()=>Array.from(new Set(rows.map(r=>r.unit))).sort((a,b)=>a.localeCompare(b,'pt-BR')),
    [rows]
  );

  const filtered=useMemo(()=>rows.filter(r=>{
    const q=search.trim().toLocaleLowerCase('pt-BR');
    const hay=`${r.name} ${r.category} ${r.preferredSupplier??''}`.toLocaleLowerCase('pt-BR');
    return (!q||hay.includes(q))
      && (status==='TODOS'||r.status===status)
      && (criticality==='TODAS'||r.criticality===criticality)
      && (unit==='TODAS'||r.unit===unit);
  }),[rows,search,status,criticality,unit]);

  return <div className="inventory-panel">
    <div className="inventory-filters">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar item, categoria ou fornecedor..." />
      <select value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="TODOS">Todos os status</option>
        <option value="CRITICO">Crítico</option>
        <option value="REPOR_AGORA">Repor agora</option>
        <option value="ATENCAO">Atenção</option>
        <option value="SEM_BASE">Sem base</option>
        <option value="OK">OK</option>
      </select>
      <select value={criticality} onChange={e=>setCriticality(e.target.value)}>
        <option value="TODAS">Todas as criticidades</option>
        <option value="CRITICO">Crítico</option>
        <option value="IMPORTANTE">Importante</option>
        <option value="NORMAL">Normal</option>
      </select>
      <select value={unit} onChange={e=>setUnit(e.target.value)}>
        <option value="TODAS">Todas as unidades</option>
        {units.map(u=><option key={u} value={u}>{u}</option>)}
      </select>
      <span className="filter-count">{filtered.length} de {rows.length} item(ns)</span>
    </div>

    {filtered.length===0
      ? <div className="empty-state">Nenhum item encontrado com os filtros atuais.</div>
      : <div className="inventory-list">
          <div className="inventory-list-head">
            <span>Status</span><span>Item</span><span>Unidade</span><span>Saldo</span><span>Cobertura</span><span>Reposição</span><span>Ação</span>
          </div>
          {filtered.map(r=><div className={`inventory-list-row ${['CRITICO','REPOR_AGORA'].includes(r.status)?'inventory-list-row-alert':''}`} key={r.id}>
            <div><span className={`status-chip status-chip-${r.status.toLowerCase()}`}>{statusLabel(r.status)}</span></div>
            <div className="inventory-main">
              <strong>{r.name}</strong>
              <small>{r.category} · {r.criticality==='CRITICO'?'Crítico':r.criticality==='IMPORTANTE'?'Importante':'Normal'}</small>
              <small>{r.preferredSupplier?`Fornecedor: ${r.preferredSupplier}`:'Fornecedor não definido'}</small>
            </div>
            <div><strong>{r.unit}</strong></div>
            <div><strong>{qty(r.stock,r.unitOfMeasure)}</strong><small>Mín.: {qty(r.minimum,r.unitOfMeasure)}</small></div>
            <div><strong>{r.coverageDays==null?'Sem base':`${Math.floor(r.coverageDays)} dias`}</strong><small>{r.dailyConsumption>0?`${qty(r.dailyConsumption,r.unitOfMeasure)}/dia`:r.consumptionSource}</small></div>
            <div><strong>{r.daysUntilReorder==null?'—':r.daysUntilReorder<=0?'Comprar agora':`em ${Math.ceil(r.daysUntilReorder)} dia(s)`}</strong><small>Ponto: {qty(r.reorderPoint,r.unitOfMeasure)}</small>{r.suggestedQuantity>0&&<small>Sugestão: {qty(r.suggestedQuantity,r.unitOfMeasure)}</small>}</div>
            <div>{canRequest && r.suggestedQuantity>0 && ['CRITICO','REPOR_AGORA'].includes(r.status)
              ? <form action={createReplenishmentRequest}><input type="hidden" name="inventoryItemId" value={r.id}/><SubmitButton className="button button-small" idleLabel="Solicitar compra" pendingLabel="Criando solicitação..." /></form>
              : <span className="muted">Acompanhar</span>}</div>
          </div>)}
        </div>}
  </div>;
}
