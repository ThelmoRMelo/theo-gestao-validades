import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SetorData {
  id: string;
  nome: string;
  percentual: number;
  meta: number;
  vendido: number;
  vendaHoje: number;
  falta: number;
  metaDiaria: number;
}

interface MetasDashboardData {
  dataSelecionada: Date;
  metaGeral: number;
  totalVendido: number;
  percentualAtingido: number;
  faltaParaMeta: number;
  metaDoDia: number;
  vendidoHoje: number;
  resultadoDia: number;
  diasNoMes: number;
  diaRef: number;
  setoresData: SetorData[];
  ranking: SetorData[];
  alertas: SetorData[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const toFilename = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ── EXCEL ──
export const exportMetasToExcel = (data: MetasDashboardData) => {
  const wb = XLSX.utils.book_new();

  // Aba 1 – Resumo
  const resumoRows = [
    ['Relatório de Metas'],
    [`Data: ${fmtDate(data.dataSelecionada)}`],
    [`Mês: ${MESES_NOMES[data.dataSelecionada.getMonth()]} ${data.dataSelecionada.getFullYear()}`],
    [],
    ['Indicador', 'Valor'],
    ['Meta do Mês', fmt(data.metaGeral)],
    ['Total Vendido', fmt(data.totalVendido)],
    ['Falta para Meta', fmt(data.faltaParaMeta)],
    ['Percentual Atingido', `${data.percentualAtingido.toFixed(1)}%`],
    ['Progresso Mensal', `${data.percentualAtingido.toFixed(1)}%`],
    [],
    ['Meta do Dia', fmt(data.metaDoDia)],
    ['Vendido Hoje', fmt(data.vendidoHoje)],
    ['Resultado do Dia', fmt(data.resultadoDia)],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
  wsResumo['!cols'] = [{ wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // Aba 2 – Setores
  const setoresHeader = ['Setor', 'Meta', 'Vendido', 'Falta', 'Meta/Dia', 'Venda/Hoje'];
  const setoresRows = data.setoresData.map(s => [
    s.nome, fmt(s.meta), fmt(s.vendido), fmt(s.falta), fmt(s.metaDiaria), fmt(s.vendaHoje),
  ]);
  const wsSetores = XLSX.utils.aoa_to_sheet([setoresHeader, ...setoresRows]);
  wsSetores['!cols'] = setoresHeader.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, wsSetores, 'Setores');

  // Aba 3 – Ranking
  const rankHeader = ['Posição', 'Setor', 'Vendido'];
  const rankRows = data.ranking.slice(0, 5).map((s, i) => [
    `${i + 1}°`, s.nome, fmt(s.vendido),
  ]);
  const wsRank = XLSX.utils.aoa_to_sheet([rankHeader, ...rankRows]);
  wsRank['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsRank, 'Ranking');

  // Aba 4 – Alertas
  const alertRows: string[][] = data.alertas.length > 0
    ? data.alertas.map(s => [s.nome, 'Abaixo do esperado'])
    : [['Todos os setores estão dentro da meta']];
  const wsAlertas = XLSX.utils.aoa_to_sheet([['Setor', 'Status'], ...alertRows]);
  wsAlertas['!cols'] = [{ wch: 22 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wsAlertas, 'Alertas');

  XLSX.writeFile(wb, `metas_${toFilename(data.dataSelecionada)}.xlsx`);
};

// ── PDF ──
export const exportMetasToPDF = (data: MetasDashboardData) => {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.width;

  // Background escuro
  const fillPage = () => {
    doc.setFillColor(20, 20, 30);
    doc.rect(0, 0, pw, doc.internal.pageSize.height, 'F');
  };
  fillPage();

  // Título
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 200, 200);
  doc.text('Relatório de Metas', pw / 2, 18, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text(`${fmtDate(data.dataSelecionada)} — ${MESES_NOMES[data.dataSelecionada.getMonth()]} ${data.dataSelecionada.getFullYear()}`, pw / 2, 26, { align: 'center' });

  // Cards
  const cardW = 56;
  const cardH = 24;
  const gap = 5;
  const startX = (pw - (cardW * 3 + gap * 2)) / 2;
  let cy = 34;

  const drawCard = (x: number, y: number, label: string, value: string, color: [number, number, number]) => {
    doc.setFillColor(30, 30, 45);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, 'F');
    doc.setDrawColor(60, 60, 80);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, 'S');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(label, x + cardW / 2, y + 8, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...color);
    doc.text(value, x + cardW / 2, y + 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  };

  const teal: [number, number, number] = [0, 200, 200];
  const green: [number, number, number] = [0, 220, 100];
  const coral: [number, number, number] = [255, 100, 100];

  drawCard(startX, cy, 'Meta do Mês', fmt(data.metaGeral), teal);
  drawCard(startX + cardW + gap, cy, 'Total Vendido', fmt(data.totalVendido), green);
  drawCard(startX + (cardW + gap) * 2, cy, 'Falta p/ Meta', fmt(data.faltaParaMeta), coral);

  cy += cardH + gap;
  drawCard(startX, cy, 'Meta do Dia', fmt(data.metaDoDia), teal);
  drawCard(startX + cardW + gap, cy, 'Vendido Hoje', fmt(data.vendidoHoje), green);
  const resColor = data.resultadoDia < 0 ? coral : green;
  const resVal = data.resultadoDia < 0 ? fmt(data.resultadoDia) : `+${fmt(data.resultadoDia)}`;
  drawCard(startX + (cardW + gap) * 2, cy, 'Resultado', resVal, resColor);

  // Progresso
  cy += cardH + 8;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('Progresso Mensal', 14, cy);
  doc.text(`${data.percentualAtingido.toFixed(1)}%`, pw - 14, cy, { align: 'right' });
  cy += 4;
  doc.setFillColor(40, 40, 55);
  doc.roundedRect(14, cy, pw - 28, 5, 2, 2, 'F');
  const barW = Math.min(pw - 28, (pw - 28) * data.percentualAtingido / 100);
  if (data.percentualAtingido >= 100) doc.setFillColor(0, 220, 100);
  else if (data.percentualAtingido >= (data.diaRef / data.diasNoMes) * 70) doc.setFillColor(0, 220, 100);
  else doc.setFillColor(255, 100, 100);
  if (barW > 0) doc.roundedRect(14, cy, barW, 5, 2, 2, 'F');

  // Tabela setores
  cy += 14;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 200, 200);
  doc.text('Desempenho por Setor', 14, cy);
  doc.setFont('helvetica', 'normal');

  autoTable(doc, {
    head: [['Setor', 'Meta', 'Vendido', 'Falta', 'Meta/Dia', 'Venda/Hoje']],
    body: data.setoresData.map(s => [
      s.nome, fmt(s.meta), fmt(s.vendido), fmt(s.falta), fmt(s.metaDiaria), fmt(s.vendaHoje),
    ]),
    startY: cy + 4,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: [200, 200, 200], fillColor: [25, 25, 40], lineColor: [50, 50, 70], lineWidth: 0.3 },
    headStyles: { fillColor: [0, 130, 130], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [30, 30, 50] },
    willDrawPage: () => fillPage(),
  });

  let nextY = (doc as any).lastAutoTable.finalY + 10;

  // Ranking
  if (nextY > doc.internal.pageSize.height - 60) { doc.addPage(); fillPage(); nextY = 20; }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 200, 50);
  doc.text('Ranking de Setores', 14, nextY);
  doc.setFont('helvetica', 'normal');

  autoTable(doc, {
    head: [['Pos.', 'Setor', 'Vendido']],
    body: data.ranking.slice(0, 5).map((s, i) => [`${i + 1}°`, s.nome, fmt(s.vendido)]),
    startY: nextY + 4,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: [200, 200, 200], fillColor: [25, 25, 40], lineColor: [50, 50, 70], lineWidth: 0.3 },
    headStyles: { fillColor: [180, 150, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [30, 30, 50] },
    willDrawPage: () => fillPage(),
  });

  nextY = (doc as any).lastAutoTable.finalY + 10;

  // Alertas
  if (nextY > doc.internal.pageSize.height - 40) { doc.addPage(); fillPage(); nextY = 20; }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 100, 100);
  doc.text('Alertas', 14, nextY);
  doc.setFont('helvetica', 'normal');

  if (data.alertas.length > 0) {
    autoTable(doc, {
      head: [['Setor', 'Status']],
      body: data.alertas.map(s => [s.nome, 'Abaixo do esperado']),
      startY: nextY + 4,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: [255, 150, 150], fillColor: [50, 20, 20], lineColor: [80, 40, 40], lineWidth: 0.3 },
      headStyles: { fillColor: [150, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' },
      willDrawPage: () => fillPage(),
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('Todos os setores estão dentro da meta 👍', 14, nextY + 8);
  }

  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Página ${i} de ${pageCount}`, pw / 2, doc.internal.pageSize.height - 8, { align: 'center' });
  }

  doc.save(`metas_${toFilename(data.dataSelecionada)}.pdf`);
};
