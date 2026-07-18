import { restoreSessionFromStorage } from '@/app/state';
import { migrateAllUserDemoTasks } from '@/lib/tasks/demo-sync';
import { initStorage, getRegistry } from '@/lib/storage/user-storage';
import { showScreen } from '@/lib/utils';
import { buildSetup, finishSetup, goLogin, goSetup, startNewAccount } from '@/app/features/setup';
import { buildLogin, cancelForgotPin, logout, openForgotPin, saveForgotPin } from '@/app/features/login';
import {
  bindShellEvents,
  enterApp,
  markAllRead,
  profileAction,
  switchTab,
  toggleNotificationMenu,
  toggleProfileMenu,
} from '@/app/features/shell';
import {
  addNote,
  chWeek,
  closeModal,
  deleteTask,
  editTask,
  onDragLeave,
  onDragOver,
  onDrop,
  openDetail,
  openNewTask,
  saveTask,
  setF,
} from '@/app/features/tasks';
import { aiTrig, bindChatSuggestEvents, closeChatSuggestions, sendMsg, toggleChatSuggestions } from '@/app/features/ai';
import { buildReport, chReportWeek, downloadReport, renderReports, switchReportTab, toggleReportDownloadMenu, viewReport } from '@/app/features/reports';
import {
  disableCloudSync,
  enableCloudSync,
  pullCloudNow,
  renderCloudSyncLogin,
  signInFromCloudOnLogin,
  signInFromCloudOnSetup,
  syncCloudNow,
} from '@/app/features/cloud-sync';
import {
  changePin,
  closePinModal,
  deleteAccount,
  exportAccountBackup,
  goSetup as openSetupFromSettings,
  handleImportBackupFile,
  hardReset,
  renderSettings,
  saveGroqKey,
  toggleSecret,
  triggerImportBackup,
} from '@/app/features/settings';

declare global {
  interface Window {
    buildSetup: typeof buildSetup;
    finishSetup: typeof finishSetup;
    goSetup: typeof goSetup;
    startNewAccount: typeof startNewAccount;
    goLogin: typeof goLogin;
    enterApp: typeof enterApp;
    logout: typeof logout;
    openForgotPin: typeof openForgotPin;
    cancelForgotPin: typeof cancelForgotPin;
    saveForgotPin: typeof saveForgotPin;
    switchTab: typeof switchTab;
    toggleProfileMenu: typeof toggleProfileMenu;
    profileAction: typeof profileAction;
    toggleNotifMenu: typeof toggleNotificationMenu;
    markAllRead: typeof markAllRead;
    chWeek: typeof chWeek;
    setF: typeof setF;
    openNewTask: typeof openNewTask;
    saveTask: typeof saveTask;
    openDetail: typeof openDetail;
    addNote: typeof addNote;
    editTask: typeof editTask;
    deleteTask: typeof deleteTask;
    onDragOver: typeof onDragOver;
    onDragLeave: typeof onDragLeave;
    onDrop: typeof onDrop;
    aiTrig: typeof aiTrig;
    toggleChatSuggestions: typeof toggleChatSuggestions;
    closeChatSuggestions: typeof closeChatSuggestions;
    sendMsg: typeof sendMsg;
    buildReport: typeof buildReport;
    chReportWeek: typeof chReportWeek;
    downloadReport: typeof downloadReport;
    toggleReportDownloadMenu: typeof toggleReportDownloadMenu;
    switchReportTab: typeof switchReportTab;
    viewReport: typeof viewReport;
    renderSettings: typeof renderSettings;
    saveGroqKey: typeof saveGroqKey;
    exportAccountBackup: typeof exportAccountBackup;
    triggerImportBackup: typeof triggerImportBackup;
    handleImportBackupFile: typeof handleImportBackupFile;
    enableCloudSync: typeof enableCloudSync;
    disableCloudSync: typeof disableCloudSync;
    syncCloudNow: typeof syncCloudNow;
    pullCloudNow: typeof pullCloudNow;
    signInFromCloudOnLogin: typeof signInFromCloudOnLogin;
    signInFromCloudOnSetup: typeof signInFromCloudOnSetup;
    hardReset: typeof hardReset;
    deleteAccount: typeof deleteAccount;
    closePinModal: typeof closePinModal;
    changePin: typeof changePin;
    toggleSecret: typeof toggleSecret;
    openModal: typeof closeModal;
    closeModal: typeof closeModal;
  }
}

export function boot(): void {
  initStorage();
  migrateAllUserDemoTasks();
  bindShellEvents();
  bindChatSuggestEvents();
  renderCloudSyncLogin();

  document.querySelectorAll('.modal-bg').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.classList.remove('open');
    });
  });

  const registry = getRegistry();
  if (!registry.users.length) {
    buildSetup();
    showScreen('setupScreen');
    return;
  }

  const restored = restoreSessionFromStorage();
  if (restored) {
    enterApp();
    return;
  }

  buildLogin(registry.lastUserId ?? registry.users[0]?.id ?? null);
  showScreen('loginScreen');
}

export function registerWindowApi(): void {
  window.buildSetup = buildSetup;
  window.finishSetup = finishSetup;
  window.goSetup = goSetup;
  window.startNewAccount = startNewAccount;

  window.goLogin = goLogin;
  window.enterApp = enterApp;
  window.logout = logout;
  window.openForgotPin = openForgotPin;
  window.cancelForgotPin = cancelForgotPin;
  window.saveForgotPin = saveForgotPin;
  window.switchTab = switchTab;
  window.toggleProfileMenu = toggleProfileMenu;
  window.profileAction = profileAction;
  window.toggleNotifMenu = toggleNotificationMenu;
  window.markAllRead = markAllRead;
  window.chWeek = chWeek;
  window.setF = setF;
  window.openNewTask = openNewTask;
  window.saveTask = saveTask;
  window.openDetail = openDetail;
  window.addNote = addNote;
  window.editTask = editTask;
  window.deleteTask = deleteTask;
  window.onDragOver = onDragOver;
  window.onDragLeave = onDragLeave;
  window.onDrop = onDrop;
  window.aiTrig = aiTrig;
  window.toggleChatSuggestions = toggleChatSuggestions;
  window.closeChatSuggestions = closeChatSuggestions;
  window.sendMsg = sendMsg;
  window.buildReport = buildReport;
  window.chReportWeek = chReportWeek;
  window.downloadReport = downloadReport;
  window.toggleReportDownloadMenu = toggleReportDownloadMenu;
  window.switchReportTab = switchReportTab;
  window.viewReport = viewReport;
  window.renderSettings = renderSettings;
  window.saveGroqKey = saveGroqKey;
  window.exportAccountBackup = exportAccountBackup;
  window.triggerImportBackup = triggerImportBackup;
  window.handleImportBackupFile = handleImportBackupFile;
  window.enableCloudSync = enableCloudSync;
  window.disableCloudSync = disableCloudSync;
  window.syncCloudNow = syncCloudNow;
  window.pullCloudNow = pullCloudNow;
  window.signInFromCloudOnLogin = signInFromCloudOnLogin;
  window.signInFromCloudOnSetup = signInFromCloudOnSetup;
  window.hardReset = hardReset;
  window.deleteAccount = deleteAccount;
  window.closePinModal = closePinModal;
  window.changePin = changePin;
  window.toggleSecret = toggleSecret;
  window.startNewAccount = startNewAccount;

  window.openModal = (id: string) => document.getElementById(id)?.classList.add('open');
  window.closeModal = closeModal;
}
