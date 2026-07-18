import type { Report, Task, TaskPriority, TaskStatus } from '@/types';
import { weekKey } from '@/lib/tasks/week';

const DEMO_WEEK_OFFSETS = [-3, -2, -1, 0] as const;

interface TaskTemplate {
  id: string;
  title: string;
  desc: string;
  prio: TaskPriority;
  status: TaskStatus;
  dueDay: number;
  tag: string;
}

const WEEK_TEMPLATES: Record<number, TaskTemplate[]> = {
  0: [
    {
      id: 'sample_todo_1',
      title: 'AI Assistant Dashboard Arayüz Çizimi',
      desc: 'Dashboard ekranları için wireframe ve yüksek sadakatli arayüz taslakları.',
      prio: 'high',
      status: 'todo',
      dueDay: 4,
      tag: 'Tasarım | UI/UX',
    },
    {
      id: 'sample_todo_2',
      title: 'n8n Otomasyon ve Webhook Testleri',
      desc: 'Webhook uç noktalarını doğrula ve otomasyon akışlarını test et.',
      prio: 'medium',
      status: 'todo',
      dueDay: 1,
      tag: 'Entegrasyon',
    },
    {
      id: 'sample_inprogress_1',
      title: 'Tasarım Sistemi (Design System) & UI Kit Güncellemesi',
      desc: 'Figma UI kit bileşenlerini güncelle ve token setini senkronize et.',
      prio: 'high',
      status: 'inprogress',
      dueDay: 2,
      tag: 'Sistem | Figma',
    },
    {
      id: 'sample_inprogress_2',
      title: 'Kullanıcı Deneyimi (UX) Persona Görüşmeleri',
      desc: 'Hedef kullanıcı segmentleri için persona görüşme notlarını derle.',
      prio: 'low',
      status: 'inprogress',
      dueDay: 6,
      tag: 'Araştırma',
    },
    {
      id: 'sample_done_1',
      title: 'Rakip Analizi ve Benchmarking Raporu',
      desc: 'Rakip ürünlerin özellik ve UX karşılaştırmasını tamamla.',
      prio: 'medium',
      status: 'done',
      dueDay: 0,
      tag: 'Strateji',
    },
    {
      id: 'sample_done_2',
      title: 'Kullanıcı Akış Şemalarının (User Flows) Çıkarılması',
      desc: 'Ana kullanıcı yolculukları için akış diyagramlarını dokümante et.',
      prio: 'high',
      status: 'done',
      dueDay: 3,
      tag: 'UX Analiz',
    },
  ],
  [-1]: [
    {
      id: 'sprint_retro',
      title: 'Sprint Retrospektifi & Aksiyon Planı',
      desc: 'Geçen sprintin çıktılarını değerlendir ve iyileştirme maddelerini ata.',
      prio: 'high',
      status: 'done',
      dueDay: 1,
      tag: 'Agile',
    },
    {
      id: 'api_docs',
      title: 'API Dokümantasyonu Güncellemesi',
      desc: 'Yeni endpoint\'ler için OpenAPI şemasını ve örnek istekleri güncelle.',
      prio: 'medium',
      status: 'done',
      dueDay: 2,
      tag: 'Backend',
    },
    {
      id: 'perf_tune',
      title: 'Performans Optimizasyonu',
      desc: 'Dashboard yükleme süresini ölç ve kritik render yolunu iyileştir.',
      prio: 'high',
      status: 'inprogress',
      dueDay: 4,
      tag: 'Performans',
    },
    {
      id: 'stakeholder',
      title: 'Stakeholder Durum Sunumu',
      desc: 'Haftalık ilerleme slaytını hazırla ve paydaşlarla paylaş.',
      prio: 'medium',
      status: 'done',
      dueDay: 3,
      tag: 'İletişim',
    },
    {
      id: 'security',
      title: 'Güvenlik Denetimi Checklist',
      desc: 'Auth akışı ve localStorage kullanımı için güvenlik kontrol listesini tamamla.',
      prio: 'high',
      status: 'todo',
      dueDay: 5,
      tag: 'Güvenlik',
    },
  ],
  [-2]: [
    {
      id: 'onboarding',
      title: 'Onboarding Akışı Prototipi',
      desc: 'Yeni kullanıcı onboarding adımlarını Figma\'da prototiple.',
      prio: 'high',
      status: 'done',
      dueDay: 0,
      tag: 'UX',
    },
    {
      id: 'analytics',
      title: 'Analytics Event Haritası',
      desc: 'Temel kullanıcı olayları için event isimlendirme standardı oluştur.',
      prio: 'medium',
      status: 'done',
      dueDay: 1,
      tag: 'Veri',
    },
    {
      id: 'qa_regression',
      title: 'Regresyon Test Senaryoları',
      desc: 'Kanban sürükle-bırak ve filtre senaryolarını QA listesine ekle.',
      prio: 'medium',
      status: 'done',
      dueDay: 2,
      tag: 'QA',
    },
    {
      id: 'mobile',
      title: 'Mobil Responsive İnce Ayar',
      desc: '600px altı kırılımlarda navbar ve board düzenini optimize et.',
      prio: 'low',
      status: 'done',
      dueDay: 3,
      tag: 'Frontend',
    },
    {
      id: 'notif_copy',
      title: 'Bildirim Metinleri Revizyonu',
      desc: 'Pazartesi/Çarşamba/Cuma rutin bildirim metinlerini netleştir.',
      prio: 'low',
      status: 'inprogress',
      dueDay: 4,
      tag: 'İçerik',
    },
    {
      id: 'dark_mode',
      title: 'Koyu Tema Kontrast Testi',
      desc: 'Dark mode metin kontrastlarını WCAG AA seviyesinde doğrula.',
      prio: 'medium',
      status: 'todo',
      dueDay: 5,
      tag: 'Erişilebilirlik',
    },
    {
      id: 'release_notes',
      title: 'Sürüm Notları Taslağı',
      desc: 'v2.0 değişikliklerini kullanıcı dostu sürüm notlarına dönüştür.',
      prio: 'low',
      status: 'todo',
      dueDay: 6,
      tag: 'Dokümantasyon',
    },
  ],
  [-3]: [
    {
      id: 'kickoff',
      title: 'Proje Kickoff Toplantısı',
      desc: 'Ekip hedeflerini netleştir ve sprint kapsamını onayla.',
      prio: 'high',
      status: 'done',
      dueDay: 0,
      tag: 'Planlama',
    },
    {
      id: 'wireframes',
      title: 'Wireframe İlk Taslaklar',
      desc: 'Task board ve rapor ekranı için düşük sadakat wireframe seti.',
      prio: 'high',
      status: 'done',
      dueDay: 2,
      tag: 'Tasarım',
    },
    {
      id: 'tech_spike',
      title: 'PWA Service Worker Spike',
      desc: 'Offline cache stratejisi için kısa teknik keşif çalışması.',
      prio: 'medium',
      status: 'inprogress',
      dueDay: 3,
      tag: 'Teknik',
    },
    {
      id: 'backlog',
      title: 'Backlog Önceliklendirme',
      desc: 'İlk sprint backlog maddelerini MoSCoW yöntemiyle sırala.',
      prio: 'medium',
      status: 'todo',
      dueDay: 4,
      tag: 'Ürün',
    },
  ],
};

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function taskIdForWeek(offset: number, suffix: string): string {
  if (offset === 0) return suffix;
  return `sample_w${offset}_${suffix}`;
}

export function createSampleTasksForOffset(offset: number): Task[] {
  const wk = weekKey(offset);
  const monday = new Date(`${wk}T12:00:00`);
  const templates = WEEK_TEMPLATES[offset] ?? [];

  return templates.map((template) => ({
    id: taskIdForWeek(offset, template.id),
    title: template.title,
    desc: template.desc,
    prio: template.prio,
    status: template.status,
    due: formatLocalDate(addDays(monday, template.dueDay)),
    tag: template.tag,
    wk,
    created: addDays(monday, Math.max(0, template.dueDay - 1)).toISOString(),
    notes: [],
  }));
}

export function createAllDemoWeekTasks(): Task[] {
  return DEMO_WEEK_OFFSETS.flatMap((offset) => createSampleTasksForOffset(offset));
}

export function createSampleTasks(forWeek = weekKey(0)): Task[] {
  void forWeek;
  return createSampleTasksForOffset(0);
}

export function isSampleTaskId(id: string): boolean {
  return id.startsWith('sample_');
}

export function isSampleReportId(id: string): boolean {
  return id.startsWith('sample_report_');
}

function buildReportSummary(total: number, done: number, inprogress: number, todo: number, overdue: number): string {
  return `Toplam ${total} görev · ${done} tamamlandı · ${inprogress} devam · ${todo} bekliyor · ${overdue} gecikmiş`;
}

function countOverdue(tasks: Task[]): number {
  const today = formatLocalDate(new Date());
  return tasks.filter((task) => task.due && task.due < today && task.status !== 'done').length;
}

export function ensureSampleReports(reports: Report[] | undefined, tasks: Task[]): Report[] {
  const customReports = (reports ?? []).filter((report) => !isSampleReportId(report.id));
  const sampleReports: Report[] = [];

  DEMO_WEEK_OFFSETS.filter((offset) => offset < 0).forEach((offset) => {
    const wk = weekKey(offset);
    if ((reports ?? []).some((report) => report.wk === wk)) return;

    const weekTasks = tasks.filter((task) => task.wk === wk);
    if (!weekTasks.length) return;

    const done = weekTasks.filter((task) => task.status === 'done').length;
    const inprogress = weekTasks.filter((task) => task.status === 'inprogress').length;
    const todo = weekTasks.filter((task) => task.status === 'todo').length;
    const overdue = countOverdue(weekTasks);
    const monday = new Date(`${wk}T12:00:00`);
    const friday = addDays(monday, 4);
    friday.setHours(16, 30, 0, 0);

    sampleReports.push({
      id: `sample_report_${offset}`,
      wk,
      created: friday.toISOString(),
      total: weekTasks.length,
      done,
      inprogress,
      todo,
      overdue,
      summary: buildReportSummary(weekTasks.length, done, inprogress, todo, overdue),
    });
  });

  return [...sampleReports, ...customReports].sort(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
  );
}

export function ensureSampleTasks(tasks: Task[] | undefined, forWeek = weekKey(0)): Task[] {
  void forWeek;
  const existing = tasks ?? [];
  const customTasks = existing.filter((task) => !isSampleTaskId(task.id));
  const demoTasks = createAllDemoWeekTasks().map((demo) => {
    const saved = existing.find((item) => item.id === demo.id);
    if (!saved) return demo;
    return {
      ...demo,
      status: saved.status,
      title: saved.title,
      desc: saved.desc,
      prio: saved.prio,
      due: saved.due,
      tag: saved.tag,
      notes: saved.notes ?? [],
    };
  });
  return [...demoTasks, ...customTasks];
}

export function tasksChanged(before: Task[] | undefined, after: Task[]): boolean {
  return JSON.stringify(before ?? []) !== JSON.stringify(after);
}

export function reportsChanged(before: Report[] | undefined, after: Report[]): boolean {
  return JSON.stringify(before ?? []) !== JSON.stringify(after);
}

export const SAMPLE_IDS = WEEK_TEMPLATES[0].map((task) => task.id);
export { DEMO_WEEK_OFFSETS };
