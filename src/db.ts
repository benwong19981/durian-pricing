import * as XLSX from "xlsx";
import { buildWorkbook, loadLatest, readWorkbookFromArrayBuffer, workbookBlob, type LoadResult } from "./excel";
import { clearFileHandle, loadFileHandle, saveFileHandle } from "./storage";
import type { State } from "./state";
import { downloadBlob } from "./util";

const SUGGESTED_NAME = "durian-prices.xlsx";
const PICKER_OPTS: FilePickerOptions = {
  types: [
    {
      description: "Excel workbook",
      accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    },
  ],
};

interface DbState {
  handle: FileSystemFileHandle | null;
  name: string | null;
  wb: XLSX.WorkBook | null;
  permissionGranted: boolean;
}

const db: DbState = { handle: null, name: null, wb: null, permissionGranted: false };

export const canPick = (): boolean => typeof window.showSaveFilePicker === "function";

export function getBarInfo(): { name: string; modeText: string } {
  const name = db.name || "none yet";
  const modeText = db.handle
    ? "∙ Save writes straight to this file"
    : db.name
      ? "∙ Save downloads an updated copy"
      : canPick()
        ? ""
        : "∙ this browser downloads copies instead of overwriting";
  return { name, modeText };
}

/** On startup: reattach a persisted file handle without prompting for permission. */
export async function restorePersistedHandle(): Promise<void> {
  if (!canPick()) return;
  const stored = await loadFileHandle();
  if (!stored) return;
  db.handle = stored.handle;
  db.name = stored.name;
  try {
    const state = await stored.handle.queryPermission({ mode: "readwrite" });
    db.permissionGranted = state === "granted";
  } catch {
    db.permissionGranted = false;
  }
}

async function readHandle(handle: FileSystemFileHandle): Promise<XLSX.WorkBook | null> {
  const f = await handle.getFile();
  if (!f.size) return null;
  return readWorkbookFromArrayBuffer(await f.arrayBuffer());
}

async function ensureWritePermission(handle: FileSystemFileHandle): Promise<boolean> {
  if (db.permissionGranted) return true;
  try {
    const result = await handle.requestPermission({ mode: "readwrite" });
    db.permissionGranted = result === "granted";
  } catch {
    db.permissionGranted = false;
  }
  return db.permissionGranted;
}

export async function saveToDb(state: State): Promise<string> {
  if (typeof XLSX === "undefined") throw new Error("The Excel library did not load. Check your connection.");
  if (db.handle) {
    const ok = await ensureWritePermission(db.handle);
    if (!ok) {
      throw new Error("Permission to write to " + db.name + " was not granted. Use Save as to pick the file again.");
    }
    const { wb, count } = buildWorkbook(state, await readHandle(db.handle));
    const ws = await db.handle.createWritable();
    await ws.write(workbookBlob(wb));
    await ws.close();
    db.wb = wb;
    return `${count} rows saved to ${db.name}`;
  }
  if (db.wb || db.name) {
    const { wb, count } = buildWorkbook(state, db.wb);
    db.wb = wb;
    downloadBlob(workbookBlob(wb), db.name || SUGGESTED_NAME);
    return `${count} rows written to a downloaded copy of ${db.name || "the database"}`;
  }
  return saveAsDb(state);
}

export async function saveAsDb(state: State): Promise<string> {
  if (typeof XLSX === "undefined") throw new Error("The Excel library did not load. Check your connection.");
  if (canPick()) {
    const handle = await window.showSaveFilePicker!({ suggestedName: SUGGESTED_NAME, ...PICKER_OPTS });
    const existing = await readHandle(handle).catch(() => null);
    const { wb, count } = buildWorkbook(state, existing);
    const ws = await handle.createWritable();
    await ws.write(workbookBlob(wb));
    await ws.close();
    db.handle = handle;
    db.name = handle.name;
    db.wb = wb;
    db.permissionGranted = true;
    await saveFileHandle(handle);
    return `${count} rows saved to ${handle.name}`;
  }
  const { wb, count } = buildWorkbook(state, db.wb);
  db.wb = wb;
  db.name = db.name || SUGGESTED_NAME;
  downloadBlob(workbookBlob(wb), db.name);
  return `${count} rows saved. This browser cannot write in place, so it downloaded instead.`;
}

export interface OpenOutcome {
  result: LoadResult;
}

export async function openDb(): Promise<OpenOutcome> {
  if (typeof XLSX === "undefined") throw new Error("The Excel library did not load. Check your connection.");
  const [handle] = await window.showOpenFilePicker!({ multiple: false, ...PICKER_OPTS });
  const wb = await readHandle(handle);
  db.handle = handle;
  db.name = handle.name;
  db.wb = wb;
  db.permissionGranted = true;
  await saveFileHandle(handle);
  if (!wb) throw new Error("That workbook is empty.");
  const result = loadLatest(wb);
  if (!result) throw new Error("That workbook has no price sheets in it.");
  return { result };
}

export async function openDbFromFile(file: File): Promise<OpenOutcome> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = readWorkbookFromArrayBuffer(buf);
  } catch {
    throw new Error("Could not read that workbook.");
  }
  db.wb = wb;
  db.name = file.name;
  db.handle = null;
  db.permissionGranted = false;
  await clearFileHandle();
  const result = loadLatest(wb);
  if (!result) throw new Error("That workbook has no price sheets in it.");
  return { result };
}
