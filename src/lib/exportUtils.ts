import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportData {
  headers: string[];
  rows: string[][];
  title: string;
}

interface SectorGroup {
  sector: string;
  rows: string[][];
}

interface ExportDataBySector {
  headers: string[];
  sectors: SectorGroup[];
  title: string;
  subtitle?: string;
  totalLotes: number;
}

// Exportação simples (sem separação por setor)
export const exportToExcel = (data: ExportData, filename: string) => {
  const worksheet = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, data.title.substring(0, 31));
  
  // Ajustar largura das colunas
  const colWidths = data.headers.map((header, i) => {
    const maxWidth = Math.max(
      header.length,
      ...data.rows.map(row => (row[i] || '').length)
    );
    return { wch: Math.min(maxWidth + 2, 50) };
  });
  worksheet['!cols'] = colWidths;
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// Exportação simples PDF (sem separação por setor)
export const exportToPDF = (data: ExportData, filename: string) => {
  const doc = new jsPDF();
  
  // Título
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(data.title, 14, 22);
  
  // Data de geração
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
  
  // Tabela
  autoTable(doc, {
    head: [data.headers],
    body: data.rows,
    startY: 38,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [0, 150, 150],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });
  
  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }
  
  doc.save(`${filename}.pdf`);
};

// Exportação Excel com separação por setor
export const exportToExcelBySector = (data: ExportDataBySector, filename: string) => {
  const allRows: string[][] = [];
  
  // Cabeçalho principal
  allRows.push([data.title]);
  allRows.push([`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`]);
  if (data.subtitle) {
    allRows.push([data.subtitle]);
  }
  allRows.push([`Total de lotes: ${data.totalLotes}`]);
  allRows.push([]); // Linha em branco
  
  // Para cada setor
  for (const sectorGroup of data.sectors) {
    // Título do setor
    allRows.push([`Setor: ${sectorGroup.sector} (${sectorGroup.rows.length} lotes)`]);
    allRows.push(data.headers);
    
    // Linhas do setor
    for (const row of sectorGroup.rows) {
      allRows.push(row);
    }
    
    allRows.push([]); // Linha em branco entre setores
  }
  
  const worksheet = XLSX.utils.aoa_to_sheet(allRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');
  
  // Ajustar largura das colunas baseado no conteúdo máximo
  const colWidths = data.headers.map((header, i) => {
    let maxWidth = header.length;
    for (const sectorGroup of data.sectors) {
      for (const row of sectorGroup.rows) {
        if (row[i] && row[i].length > maxWidth) {
          maxWidth = row[i].length;
        }
      }
    }
    return { wch: Math.min(maxWidth + 2, 50) };
  });
  worksheet['!cols'] = colWidths;
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// Exportação PDF com separação por setor (formato do modelo)
export const exportToPDFBySector = (data: ExportDataBySector, filename: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Título principal
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(data.title, 14, 18);
  
  // Data de geração
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 26);
  
  // Total de lotes
  doc.text(`Total de lotes ativos: ${data.totalLotes}`, 14, 32);
  
  let startY = 40;
  
  // Para cada setor, criar uma seção
  for (let sectorIndex = 0; sectorIndex < data.sectors.length; sectorIndex++) {
    const sectorGroup = data.sectors[sectorIndex];
    
    // Verificar se precisa de nova página
    if (startY > doc.internal.pageSize.height - 50) {
      doc.addPage();
      startY = 20;
    }
    
    // Título do setor
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 100, 100);
    doc.text(`Setor: ${sectorGroup.sector} (${sectorGroup.rows.length} lotes)`, 14, startY);
    doc.setTextColor(0, 0, 0);
    
    // Tabela do setor
    autoTable(doc, {
      head: [data.headers],
      body: sectorGroup.rows,
      startY: startY + 4,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [0, 130, 130],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      columnStyles: {
        0: { cellWidth: 'auto' }, // Produto
        1: { cellWidth: 30 }, // Código
        2: { cellWidth: 18 }, // Qtd
        3: { cellWidth: 24 }, // Validade
        4: { cellWidth: 22 }, // Dias Rest.
      },
      margin: { left: 14, right: 14 },
      didDrawPage: () => {
        // Não fazer nada aqui, o rodapé será adicionado depois
      },
    });
    
    // Pegar posição Y final da tabela
    startY = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
    doc.setTextColor(0, 0, 0);
  }
  
  doc.save(`${filename}.pdf`);
};
