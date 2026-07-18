import * as XLSX from 'xlsx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Task, TaskPriority, TaskStatus } from '@/types';

pdfMake.addVirtualFileSystem(pdfFonts);

export interface ReportExportPayload {
  userName: string;
  weekLabel: string;
  weekKey: string;
  generatedAt: string;
  stats: {
    total: number;
    done: number;
    inprogress: number;
    todo: number;
    overdue: number;
    completion: number;
    high: number;
    medium: number;
    low: number;
  };
  summary?: string;
  tasks: Task[];
}

function statusLabel(status: TaskStatus): string {
  return { todo: 'Bekliyor', inprogress: 'Devam Ediyor', done: 'Tamamlandı' }[status];
}

function priorityLabel(priority: TaskPriority): string {
  return { high: 'Yüksek', medium: 'Orta', low: 'Düşük' }[priority];
}

function exportFileName(weekKey: string, extension: 'xlsx' | 'pdf'): string {
  return `TeamFlow_Rapor_${weekKey}.${extension}`;
}

export function exportReportExcel(payload: ReportExportPayload): void {
  const summaryRows = [
    ['TeamFlow Performans Raporu'],
    ['Kullanıcı', payload.userName],
    ['Hafta', `${payload.weekLabel} (${payload.weekKey})`],
    ['Oluşturulma', payload.generatedAt],
    [],
    ['Metrik', 'Değer'],
    ['Toplam görev', payload.stats.total],
    ['Tamamlanan', payload.stats.done],
    ['Devam eden', payload.stats.inprogress],
    ['Bekleyen', payload.stats.todo],
    ['Gecikmiş', payload.stats.overdue],
    ['Tamamlanma oranı', `${payload.stats.completion}%`],
    ['Yüksek öncelik', payload.stats.high],
    ['Orta öncelik', payload.stats.medium],
    ['Düşük öncelik', payload.stats.low],
  ];

  if (payload.summary) {
    summaryRows.push([], ['Özet', payload.summary]);
  }

  const taskRows = payload.tasks.map((task) => ({
    Başlık: task.title,
    Açıklama: task.desc,
    Durum: statusLabel(task.status),
    Öncelik: priorityLabel(task.prio),
    'Son tarih': task.due || '-',
    Etiket: task.tag || '-',
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Özet');
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(taskRows.length ? taskRows : [{ Başlık: 'Bu hafta görev yok' }]),
    'Görevler',
  );
  XLSX.writeFile(workbook, exportFileName(payload.weekKey, 'xlsx'));
}

export function exportReportPdf(payload: ReportExportPayload): void {
  const summaryBody = [
    ['Toplam', String(payload.stats.total)],
    ['Tamamlanan', String(payload.stats.done)],
    ['Devam eden', String(payload.stats.inprogress)],
    ['Bekleyen', String(payload.stats.todo)],
    ['Gecikmiş', String(payload.stats.overdue)],
    ['Tamamlanma', `${payload.stats.completion}%`],
    ['Yüksek öncelik', String(payload.stats.high)],
    ['Orta öncelik', String(payload.stats.medium)],
    ['Düşük öncelik', String(payload.stats.low)],
  ];

  const taskBody = payload.tasks.length
    ? payload.tasks.map((task) => [
        task.title,
        statusLabel(task.status),
        priorityLabel(task.prio),
        task.due || '-',
        task.tag || '-',
      ])
    : [['Bu hafta görev yok', '-', '-', '-', '-']];

  const content: Content[] = [
    { text: 'TeamFlow Performans Raporu', style: 'title', margin: [0, 0, 0, 8] },
    {
      columns: [
        { width: '*', text: [{ text: 'Kullanıcı: ', bold: true }, payload.userName] },
        { width: 'auto', text: [{ text: 'Hafta: ', bold: true }, `${payload.weekLabel} (${payload.weekKey})`] },
      ],
      margin: [0, 0, 0, 4],
    },
    { text: [{ text: 'Oluşturulma: ', bold: true }, payload.generatedAt], margin: [0, 0, 0, 12] },
    { text: 'Performans Özeti', style: 'section', margin: [0, 0, 0, 6] },
    {
      table: {
        widths: ['*', 'auto'],
        body: summaryBody,
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 12],
    },
  ];

  if (payload.summary) {
    content.push(
      { text: 'Haftalık Özet', style: 'section', margin: [0, 0, 0, 6] },
      { text: payload.summary, margin: [0, 0, 0, 12] },
    );
  }

  content.push(
    { text: 'Görev Listesi', style: 'section', margin: [0, 0, 0, 6] },
    {
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto', 'auto'],
        body: [
          ['Başlık', 'Durum', 'Öncelik', 'Son Tarih', 'Etiket'],
          ...taskBody,
        ],
      },
      layout: 'lightHorizontalLines',
    },
  );

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 48],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    styles: {
      title: { fontSize: 18, bold: true },
      section: { fontSize: 12, bold: true, color: '#f97316' },
    },
    content,
  };

  pdfMake.createPdf(docDefinition).download(exportFileName(payload.weekKey, 'pdf'));
}
