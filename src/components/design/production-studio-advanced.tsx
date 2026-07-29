"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  Download,
  Eye,
  EyeOff,
  Grid3X3,
  History,
  ImagePlus,
  Layers3,
  Lock,
  MonitorCog,
  PanelBottomOpen,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  Scissors,
  Send,
  Square,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  Usb,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MachineProfilePanel } from "@/components/design/machine-profile-panel";
import { Button } from "@/components/ui/button";
import {
  buildCutDxf,
  buildCutHpgl,
  buildCutSvg,
  buildDesignCutPaths,
} from "@/lib/design-cut-path";
import { outlineDesignTextLayers } from "@/lib/design-text-outline";
import {
  normalizeMachineOrigin,
  normalizeMachineOutputFormat,
  productionWorkflowForProfile,
  type DesignMachineProfile,
} from "@/lib/design-machine-profile";
import {
  DESIGN_PROJECT_VERSION,
  designRecoveryStorageKey,
  isMeaningfulDesignProject,
  isRecoveryNewerThanSaved,
  migrateDesignProject,
  parseDesignRecoveryDraft,
  serializeDesignRecoveryDraft,
  type DesignRecoveryDraft,
} from "@/lib/design-recovery";
import {
  buildPrintDocument,
  checkProductionDesign,
  clampLayerToSheet,
  type ProductionLayer,
} from "@/lib/design-production";
import {
  groupSelectedLayers,
  moveSelectedLayers,
  selectLayerUnit,
  ungroupSelectedLayers,
} from "@/lib/design-selection";
import {
  resizeLayerFromHandle,
  rotateLayerToPoint,
  type TransformHandle,
} from "@/lib/design-transform";

type Material = "htv" | "printable-htv" | "sublimation" | "dtf" | "flock";
type Sheet = "a4" | "a3" | "12x20" | "15x20" | "custom";
type DeviceState = "not-configured" | "unsupported" | "selecting" | "connected" | "error";
type LayerKind = ProductionLayer["kind"];
type SavedDesign = {
  id: string;
  title: string;
  updatedAt: string;
  canvas: Record<string, unknown>;
};
type DesignLayer = ProductionLayer & {
  content?: string;
  url?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  fontFamily?: string;
  fontWeight?: number;
  groupId?: string;
};
type DesignVersionSummary = {
  id: string;
  versionNumber: number;
  title: string;
  machineProfile: string | null;
  source: string;
  sourceLabel: string;
  createdByName: string;
  createdAt: string;
};

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
};
type NavigatorWithSerial = Navigator & { serial?: { requestPort(): Promise<SerialPortLike> } };
type DragState = {
  ids: string[];
  startPoint: { x: number; y: number };
  startLayers: DesignLayer[];
};
type TransformState =
  | { kind: "resize"; layerId: string; handle: TransformHandle; startLayers: DesignLayer[] }
  | { kind: "rotate"; layerId: string; startLayers: DesignLayer[] };

const sheets: Record<Exclude<Sheet, "custom">, { label: string; width: number; height: number }> = {
  a4: { label: "A4", width: 210, height: 297 },
  a3: { label: "A3", width: 297, height: 420 },
  "12x20": { label: "12 × 20 in", width: 305, height: 508 },
  "15x20": { label: "15 × 20 in", width: 381, height: 508 },
};

const materialDetails: Record<Material, { label: string; instruction: string; defaultMirror: boolean }> = {
  htv: { label: "Heat-transfer vinyl (HTV)", instruction: "Mirror before cutting. Weed, cover, then press to the vinyl maker's specification.", defaultMirror: true },
  "printable-htv": { label: "Printable HTV", instruction: "Print on the printable face, contour-cut, mask if required, then heat apply.", defaultMirror: false },
  sublimation: { label: "Sublimation paper", instruction: "Mirror before printing. Use the correct polyester material and ink/paper profile.", defaultMirror: true },
  dtf: { label: "DTF transfer film", instruction: "Print through the RIP workflow, powder and cure, then heat apply.", defaultMirror: false },
  flock: { label: "Flock vinyl", instruction: "Mirror before cutting. Weed carefully and follow the material temperature and peel instructions.", defaultMirror: true },
};

const allowedFonts = ["Arial", "Impact", "Georgia", "Courier New", "Times New Roman"];
const fallbackMachineProfile: DesignMachineProfile = {
  id: "fallback-generic-svg",
  name: "Generic SVG cutter",
  outputFormat: "SVG_CUT",
  bedWidthMm: 305,
  bedHeightMm: 508,
  unitsPerMm: 40,
  baudRate: 9600,
  origin: "BOTTOM_LEFT",
  mirrorDefault: true,
  isDefault: true,
  isActive: true,
};
const transformHandles: Array<{ handle: TransformHandle; x: -1 | 1; y: -1 | 1 }> = [
  { handle: "north-west", x: -1, y: -1 },
  { handle: "north-east", x: 1, y: -1 },
  { handle: "south-east", x: 1, y: 1 },
  { handle: "south-west", x: -1, y: 1 },
];

function id() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function safeName(value: string) {
  return value.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "design-job";
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function finiteNumber(value: unknown, fallback: number, min = -100_000, max = 100_000) {
  const number = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function machineProfileSnapshot(value: unknown, fallbackName: string, fallbackId: string): DesignMachineProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const profile = value as Record<string, unknown>;
  const name = typeof profile.name === "string" && profile.name.trim() ? profile.name.slice(0, 80) : fallbackName;
  return {
    id: typeof profile.id === "string" && profile.id.trim() ? profile.id.slice(0, 100) : fallbackId,
    name,
    outputFormat: normalizeMachineOutputFormat(profile.outputFormat),
    bedWidthMm: finiteNumber(profile.bedWidthMm, 305, 20, 2_000),
    bedHeightMm: finiteNumber(profile.bedHeightMm, 508, 20, 5_000),
    unitsPerMm: Math.round(finiteNumber(profile.unitsPerMm, 40, 1, 1_000)),
    baudRate: Math.round(finiteNumber(profile.baudRate, 9600, 300, 1_000_000)),
    origin: normalizeMachineOrigin(profile.origin),
    mirrorDefault: profile.mirrorDefault !== false,
    isDefault: profile.isDefault === true,
    isActive: false,
  };
}

function normalizedLayers(value: unknown[], sheetSize?: { width: number; height: number }): DesignLayer[] {
  const kinds: LayerKind[] = ["image", "text", "rectangle", "circle"];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const layer = entry as Record<string, unknown>;
    if (!kinds.includes(layer.kind as LayerKind)) return [];
    const kind = layer.kind as LayerKind;
    const rawUrl = typeof layer.url === "string" ? layer.url.slice(0, 1_500_000) : undefined;
    const url = rawUrl && (/^data:image\/(?:png|jpeg|webp|avif|svg\+xml);base64,/i.test(rawUrl) || rawUrl.startsWith("/api/media/local/") || /^https:\/\//i.test(rawUrl)) ? rawUrl : undefined;
    const normalized: DesignLayer = {
      id: typeof layer.id === "string" ? layer.id.slice(0, 100) : id(),
      kind,
      name: typeof layer.name === "string" ? layer.name.slice(0, 120) : "Layer",
      visible: layer.visible !== false,
      locked: layer.locked === true,
      x: finiteNumber(layer.x, 0),
      y: finiteNumber(layer.y, 0),
      width: finiteNumber(layer.width, 20, 1),
      height: finiteNumber(layer.height, 20, 1),
      rotation: finiteNumber(layer.rotation, 0, -3600, 3600),
      color: typeof layer.color === "string" && /^#[0-9a-f]{6}$/i.test(layer.color) ? layer.color : "#111827",
      content: typeof layer.content === "string" ? layer.content.slice(0, 500) : undefined,
      url,
      sourceWidth: finiteNumber(layer.sourceWidth, 1, 1),
      sourceHeight: finiteNumber(layer.sourceHeight, 1, 1),
      fontFamily: typeof layer.fontFamily === "string" && allowedFonts.includes(layer.fontFamily) ? layer.fontFamily : "Arial",
      fontWeight: finiteNumber(layer.fontWeight, 700, 100, 900),
      groupId: typeof layer.groupId === "string" && layer.groupId.trim() ? layer.groupId.slice(0, 100) : undefined,
    };
    return [sheetSize ? clampLayerToSheet(normalized, sheetSize) : normalized];
  });
}

function download(name: string, content: string, type: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([content], { type }));
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1_000);
}

function fileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read artwork."));
    reader.readAsDataURL(file);
  });
}

function imageDimensions(url: string) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
    image.onerror = () => resolve({ width: 1, height: 1 });
    image.src = url;
  });
}

function recoveryTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function historyTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function DesignStudioAdvanced({
  savedDesigns = [],
  recoveryScope,
  initialMachineProfiles,
  canManageMachineProfiles,
}: {
  savedDesigns?: SavedDesign[];
  recoveryScope: string;
  initialMachineProfiles: DesignMachineProfile[];
  canManageMachineProfiles: boolean;
}) {
  const router = useRouter();
  const gridId = `design-grid-${useId().replace(/:/g, "")}`;
  const recoveryKey = useMemo(() => designRecoveryStorageKey(recoveryScope), [recoveryScope]);
  const startingMachineProfile = initialMachineProfiles.find((profile) => profile.isDefault && profile.isActive)
    ?? initialMachineProfiles.find((profile) => profile.isActive)
    ?? initialMachineProfiles[0]
    ?? fallbackMachineProfile;
  const [designJobId, setDesignJobId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("Not saved yet");
  const [recoveryMessage, setRecoveryMessage] = useState("Local recovery is starting…");
  const [recoveryDraft, setRecoveryDraft] = useState<DesignRecoveryDraft | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [authoritativeFingerprint, setAuthoritativeFingerprint] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [historyStatus, setHistoryStatus] = useState("Save the project to begin version history");
  const [versions, setVersions] = useState<DesignVersionSummary[]>([]);
  const [openingVersion, setOpeningVersion] = useState<number | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [jobName, setJobName] = useState("New design job");
  const [customer, setCustomer] = useState("");
  const [material, setMaterial] = useState<Material>("htv");
  const [sheet, setSheet] = useState<Sheet>("a3");
  const [customWidth, setCustomWidth] = useState(300);
  const [customHeight, setCustomHeight] = useState(500);
  const [copies, setCopies] = useState(1);
  const [mirror, setMirror] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [weedBox, setWeedBox] = useState(true);
  const [registrationMarks, setRegistrationMarks] = useState(false);
  const [contourOffset, setContourOffset] = useState(0);
  const [availableMachineProfiles, setAvailableMachineProfiles] = useState<DesignMachineProfile[]>(initialMachineProfiles.length ? initialMachineProfiles : [fallbackMachineProfile]);
  const [machineProfileId, setMachineProfileId] = useState(startingMachineProfile.id);
  const [newText, setNewText] = useState("");
  const [layers, setLayers] = useState<DesignLayer[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primarySelectedId, setPrimarySelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<DesignLayer[][]>([]);
  const [future, setFuture] = useState<DesignLayer[][]>([]);
  const [device, setDevice] = useState<DeviceState>("not-configured");
  const [deviceName, setDeviceName] = useState("No output device selected");
  const [deviceMessage, setDeviceMessage] = useState("System printing and SVG export are ready. A compatible serial cutter can also receive checked HPGL vector jobs.");
  const [cutExportMessage, setCutExportMessage] = useState("Editable text will be outlined automatically when cutter output is prepared.");
  const [cutExporting, setCutExporting] = useState(false);
  const [baudRate, setBaudRate] = useState(startingMachineProfile.baudRate);
  const portRef = useRef<SerialPortLike | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const transformRef = useRef<TransformState | null>(null);
  const recoveryTimerRef = useRef<number | null>(null);
  const authoritativeFingerprintRef = useRef<string | null>(null);

  const size = sheet === "custom" ? { label: "Custom", width: customWidth, height: customHeight } : sheets[sheet];
  const machineProfile = availableMachineProfiles.find((profile) => profile.id === machineProfileId)
    ?? availableMachineProfiles.find((profile) => profile.isDefault && profile.isActive)
    ?? availableMachineProfiles.find((profile) => profile.isActive)
    ?? fallbackMachineProfile;
  const productionWorkflow = productionWorkflowForProfile(machineProfile);
  const productionValidationWorkflow = machineProfile.outputFormat === "HPGL" ? "Generic SVG" : productionWorkflow;
  const selected = layers.find((layer) => layer.id === primarySelectedId) ?? null;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedLayers = useMemo(() => layers.filter((layer) => selectedSet.has(layer.id)), [layers, selectedSet]);
  const canUngroup = selectedLayers.some((layer) => Boolean(layer.groupId));
  const handleRadius = Math.max(3, Math.min(7, Math.min(size.width, size.height) / 70));
  const rotationHandleOffset = handleRadius * 4;
  const projectSnapshot = useMemo(() => ({
    version: DESIGN_PROJECT_VERSION,
    jobName,
    customer,
    material,
    sheet,
    customWidth,
    customHeight,
    copies,
    mirror,
    showGrid,
    snap,
    weedBox,
    registrationMarks,
    contourOffset,
    machineProfile: machineProfile.name,
    machineProfileId: machineProfile.id,
    machineSettings: machineProfile,
    layers,
  }), [jobName, customer, material, sheet, customWidth, customHeight, copies, mirror, showGrid, snap, weedBox, registrationMarks, contourOffset, machineProfile, layers]);
  const projectFingerprint = useMemo(() => JSON.stringify(projectSnapshot), [projectSnapshot]);
  const hasUnsavedChanges = projectFingerprint !== authoritativeFingerprint;
  const productionCheck = useMemo(() => checkProductionDesign({
    layers,
    sheet: size,
    machineProfile: productionValidationWorkflow,
    material,
    mirror,
    registrationMarks,
    copies,
  }), [layers, size.width, size.height, productionValidationWorkflow, material, mirror, registrationMarks, copies]);
  const cutPathResult = useMemo(() => buildDesignCutPaths({
    layers,
    sheet: size,
    weedBox,
    registrationMarks,
  }), [layers, size.width, size.height, weedBox, registrationMarks]);
  const usesCutPaths = machineProfile.outputFormat !== "PRINT_RIP";
  const copyErrors = usesCutPaths && copies !== 1
    ? ["Arrange multiple copies as separate artwork on the sheet before cutter export; repeating one path can damage the material."]
    : [];
  const productionErrors = [...new Set(usesCutPaths ? [...productionCheck.errors, ...cutPathResult.errors, ...copyErrors] : productionCheck.errors)];
  const productionWarnings = [...new Set(usesCutPaths ? [...productionCheck.warnings, ...cutPathResult.warnings] : productionCheck.warnings)];
  const productionBlocked = productionErrors.length > 0;
  const printBlocked = productionCheck.errors.length > 0;

  useEffect(() => {
    try {
      const stored = parseDesignRecoveryDraft({ raw: window.localStorage.getItem(recoveryKey) });
      if (!stored) {
        window.localStorage.removeItem(recoveryKey);
        setRecoveryMessage("Local recovery is ready");
        setRecoveryReady(true);
        return;
      }

      const serverCopy = stored.designJobId ? savedDesigns.find((design) => design.id === stored.designJobId) : null;
      if (serverCopy && !isRecoveryNewerThanSaved({ draft: stored, savedDesignUpdatedAt: serverCopy.updatedAt })) {
        window.localStorage.removeItem(recoveryKey);
        setRecoveryMessage("The shop copy is newer; stale recovery was cleared");
      } else {
        setRecoveryDraft(stored);
        setRecoveryMessage("Recovered work is waiting for your decision");
      }
    } catch {
      setRecoveryMessage("Local recovery is unavailable in this browser");
    } finally {
      setRecoveryReady(true);
    }
  }, [recoveryKey, savedDesigns]);

  useEffect(() => {
    if (!recoveryReady || recoveryDraft) return;
    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    if (!hasUnsavedChanges || !isMeaningfulDesignProject(projectSnapshot)) {
      try {
        window.localStorage.removeItem(recoveryKey);
      } catch {
        // Private browsing or disabled storage may reject writes.
      }
      setRecoveryMessage(hasUnsavedChanges ? "No recovery draft needed" : "Shop copy is current; no recovery draft needed");
      return;
    }

    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = null;
      if (projectFingerprint === authoritativeFingerprintRef.current) return;
      const serialized = serializeDesignRecoveryDraft({ project: projectSnapshot, designJobId });
      if (!serialized.ok) {
        setRecoveryMessage(serialized.reason === "too-large"
          ? "Recovery draft is too large; download a backup before leaving"
          : "This project could not be prepared for recovery");
        return;
      }
      try {
        window.localStorage.setItem(recoveryKey, serialized.value);
        setRecoveryMessage(`Recovery draft saved at ${new Date(serialized.draft.savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`);
      } catch {
        setRecoveryMessage("Browser storage is full; download a backup before leaving");
      }
    }, 1_200);

    return () => {
      if (recoveryTimerRef.current !== null) {
        window.clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    };
  }, [projectSnapshot, projectFingerprint, hasUnsavedChanges, designJobId, recoveryDraft, recoveryKey, recoveryReady]);

  useEffect(() => {
    if (!recoveryReady || recoveryDraft) return;
    const persistBeforeExit = () => {
      if (projectFingerprint === authoritativeFingerprintRef.current || !isMeaningfulDesignProject(projectSnapshot)) return;
      const serialized = serializeDesignRecoveryDraft({ project: projectSnapshot, designJobId });
      if (!serialized.ok) return;
      try {
        window.localStorage.setItem(recoveryKey, serialized.value);
      } catch {
        // The normal status message already explains unavailable storage.
      }
    };
    window.addEventListener("pagehide", persistBeforeExit);
    return () => window.removeEventListener("pagehide", persistBeforeExit);
  }, [projectSnapshot, projectFingerprint, designJobId, recoveryDraft, recoveryKey, recoveryReady]);

  useEffect(() => {
    if (!inspectorOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setInspectorOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [inspectorOpen]);

  useEffect(() => {
    if (!designJobId) {
      setVersions([]);
      setHistoryStatus("Save the project to begin version history");
      return;
    }

    const controller = new AbortController();
    setHistoryStatus("Loading version history…");
    fetch(`/api/designs/${encodeURIComponent(designJobId)}/versions`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { versions?: DesignVersionSummary[]; error?: string };
        if (!response.ok || !result.versions) throw new Error(result.error ?? "Could not load version history.");
        setVersions(result.versions);
        setHistoryStatus(result.versions.length ? `${result.versions.length} saved version${result.versions.length === 1 ? "" : "s"}` : "No versions saved yet");
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setVersions([]);
        setHistoryStatus(error instanceof Error ? error.message : "Could not load version history.");
      });
    return () => controller.abort();
  }, [designJobId]);

  function setSelection(ids: string[], primary: string | null = ids.at(-1) ?? null) {
    setSelectedIds(ids);
    setPrimarySelectedId(primary && ids.includes(primary) ? primary : ids.at(-1) ?? null);
  }

  function checkpoint(next: DesignLayer[]) {
    setPast((items) => [...items.slice(-39), layers]);
    setFuture([]);
    setLayers(next);
  }

  function updateLayer(layerId: string, changes: Partial<DesignLayer>, remember = true) {
    const next = layers.map((layer) => layer.id === layerId ? clampLayerToSheet({ ...layer, ...changes }, size) : layer);
    if (remember) checkpoint(next); else setLayers(next);
  }

  function addLayer(layer: DesignLayer) {
    const safeLayer = clampLayerToSheet(layer, size);
    checkpoint([...layers, safeLayer]);
    setSelection([safeLayer.id], safeLayer.id);
  }

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((items) => [layers, ...items].slice(0, 40));
    setLayers(previous);
    setPast((items) => items.slice(0, -1));
    setSelection(selectedIds.filter((selectedId) => previous.some((layer) => layer.id === selectedId)), primarySelectedId);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((items) => [...items, layers].slice(-40));
    setLayers(next);
    setFuture((items) => items.slice(1));
    setSelection(selectedIds.filter((selectedId) => next.some((layer) => layer.id === selectedId)), primarySelectedId);
  }

  function snapValue(value: number) {
    return snap ? Math.round(value / 5) * 5 : Math.round(value * 10) / 10;
  }

  function canvasPoint(clientX: number, clientY: number) {
    const svg = canvasRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(matrix.inverse());
  }

  function chooseLayer(layer: DesignLayer, additive: boolean) {
    const next = selectLayerUnit({ layers, selectedIds, layerId: layer.id, additive });
    setSelection(next, next.includes(layer.id) ? layer.id : next.at(-1) ?? null);
    return next;
  }

  function startResize(event: ReactPointerEvent<SVGGElement>, layer: DesignLayer, handle: TransformHandle) {
    event.stopPropagation();
    if (layer.locked) return;
    setPast((items) => [...items.slice(-39), layers]);
    setFuture([]);
    transformRef.current = { kind: "resize", layerId: layer.id, handle, startLayers: layers };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startRotate(event: ReactPointerEvent<SVGGElement>, layer: DesignLayer) {
    event.stopPropagation();
    if (layer.locked) return;
    setPast((items) => [...items.slice(-39), layers]);
    setFuture([]);
    transformRef.current = { kind: "rotate", layerId: layer.id, startLayers: layers };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startDrag(event: ReactPointerEvent<SVGGElement>, layer: DesignLayer) {
    event.stopPropagation();
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    const nextSelection = chooseLayer(layer, additive);
    if (layer.locked || additive) return;
    const point = canvasPoint(event.clientX, event.clientY);
    if (!point) return;
    setPast((items) => [...items.slice(-39), layers]);
    setFuture([]);
    dragRef.current = {
      ids: nextSelection.length ? nextSelection : [layer.id],
      startPoint: point,
      startLayers: layers,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(event: ReactPointerEvent<SVGSVGElement>) {
    const point = canvasPoint(event.clientX, event.clientY);
    if (!point) return;

    const transform = transformRef.current;
    if (transform) {
      const startLayer = transform.startLayers.find((layer) => layer.id === transform.layerId);
      if (!startLayer) return;
      const nextLayer = transform.kind === "resize"
        ? resizeLayerFromHandle({
            layer: startLayer,
            handle: transform.handle,
            point,
            sheet: size,
            preserveAspect: startLayer.kind === "image" || startLayer.kind === "text" || event.shiftKey,
          })
        : rotateLayerToPoint({ layer: startLayer, point, sheet: size, snapDegrees: event.shiftKey ? 15 : 0 });
      setLayers(transform.startLayers.map((layer) => layer.id === nextLayer.id ? nextLayer : layer));
      return;
    }

    const active = dragRef.current;
    if (!active) return;
    setLayers(moveSelectedLayers({
      layers: active.startLayers,
      selectedIds: active.ids,
      dx: snapValue(point.x - active.startPoint.x),
      dy: snapValue(point.y - active.startPoint.y),
      sheet: size,
    }));
  }

  function endDrag() {
    dragRef.current = null;
    transformRef.current = null;
  }

  function nudgeLayer(event: ReactKeyboardEvent<SVGGElement>, layer: DesignLayer) {
    if (layer.locked) return;
    const amount = event.shiftKey ? 5 : 1;
    const moves: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -amount, y: 0 },
      ArrowRight: { x: amount, y: 0 },
      ArrowUp: { x: 0, y: -amount },
      ArrowDown: { x: 0, y: amount },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const activeSelection = selectedIds.includes(layer.id) ? selectedIds : chooseLayer(layer, false);
    checkpoint(moveSelectedLayers({ layers, selectedIds: activeSelection, dx: move.x, dy: move.y, sheet: size }));
  }

  function groupSelection() {
    if (selectedIds.length < 2) return;
    checkpoint(groupSelectedLayers(layers, selectedIds, id()));
  }

  function ungroupSelection() {
    if (!canUngroup) return;
    checkpoint(ungroupSelectedLayers(layers, selectedIds));
  }

  function deleteSelection() {
    if (!selectedIds.length) return;
    const selection = new Set(selectedIds);
    checkpoint(layers.filter((layer) => !selection.has(layer.id)));
    setSelection([]);
  }

  function duplicateSelection() {
    if (!selectedIds.length) return;
    const selection = new Set(selectedIds);
    const groupIds = new Map<string, string>();
    const copies = layers.filter((layer) => selection.has(layer.id)).map((layer) => {
      const groupId = layer.groupId
        ? groupIds.get(layer.groupId) ?? (() => {
            const next = id();
            groupIds.set(layer.groupId as string, next);
            return next;
          })()
        : undefined;
      return clampLayerToSheet({
        ...layer,
        id: id(),
        name: `${layer.name} copy`.slice(0, 120),
        x: layer.x + 5,
        y: layer.y + 5,
        groupId,
      }, size);
    });
    if (!copies.length) return;
    checkpoint([...layers, ...copies]);
    setSelection(copies.map((layer) => layer.id), copies.at(-1)?.id ?? null);
  }

  async function uploadArtwork(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const additions: DesignLayer[] = [];
    setUploadMessage(files.length ? "Uploading artwork…" : "");
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".svg")) continue;
        let url: string;
        let dimensions: { width: number; height: number };
        if (file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml") {
          if (file.size > 1_000_000) throw new Error("SVG artwork must be smaller than 1 MB.");
          url = await fileDataUrl(file);
          dimensions = await imageDimensions(url);
        } else {
          const body = new FormData();
          body.set("file", file);
          body.set("kind", "DESIGN_ASSET");
          const response = await fetch("/api/uploads", { method: "POST", body });
          const result = await response.json() as { asset?: { url: string; width?: number | null; height?: number | null }; error?: string };
          if (!response.ok || !result.asset) throw new Error(result.error ?? `Could not upload ${file.name}.`);
          url = result.asset.url;
          dimensions = { width: result.asset.width || 1, height: result.asset.height || 1 };
        }
        const width = Math.min(120, size.width * 0.55);
        additions.push(clampLayerToSheet({
          id: id(),
          kind: "image",
          name: file.name.slice(0, 120),
          visible: true,
          locked: false,
          x: size.width / 2,
          y: size.height / 2,
          width,
          height: Math.max(1, width * dimensions.height / Math.max(1, dimensions.width)),
          rotation: 0,
          color: "#111827",
          url,
          sourceWidth: dimensions.width,
          sourceHeight: dimensions.height,
        }, size));
      }
      if (additions.length) {
        checkpoint([...layers, ...additions]);
        setSelection(additions.map((layer) => layer.id), additions.at(-1)?.id ?? null);
        setUploadMessage(`${additions.length} artwork file${additions.length === 1 ? "" : "s"} added`);
      } else if (files.length) {
        setUploadMessage("No supported artwork files were selected.");
      }
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Artwork upload failed.");
    }
    event.target.value = "";
  }

  function addText() {
    const content = newText.trim() || "New text";
    addLayer({
      id: id(),
      kind: "text",
      name: content.slice(0, 24),
      content: content.slice(0, 500),
      visible: true,
      locked: false,
      x: size.width / 2,
      y: size.height / 2,
      width: Math.min(120, size.width * 0.6),
      height: 20,
      rotation: 0,
      color: "#111827",
      fontFamily: "Arial",
      fontWeight: 700,
    });
    setNewText("");
  }

  function addShape(kind: "rectangle" | "circle") {
    addLayer({
      id: id(),
      kind,
      name: kind === "circle" ? "Circle" : "Rectangle",
      visible: true,
      locked: false,
      x: size.width / 2,
      y: size.height / 2,
      width: Math.min(60, size.width * 0.5),
      height: Math.min(kind === "circle" ? 60 : 35, size.height * 0.5),
      rotation: 0,
      color: "#111827",
    });
  }

  function duplicateLayer(layer: DesignLayer) {
    const copy = clampLayerToSheet({ ...layer, id: id(), name: `${layer.name} copy`.slice(0, 120), x: layer.x + 5, y: layer.y + 5, groupId: undefined }, size);
    checkpoint([...layers, copy]);
    setSelection([copy.id], copy.id);
  }

  function moveLayer(layerId: string, direction: -1 | 1) {
    const index = layers.findIndex((layer) => layer.id === layerId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= layers.length) return;
    const next = [...layers];
    [next[index], next[target]] = [next[target], next[index]];
    checkpoint(next);
  }

  function svgDocument() {
    const elements = layers.filter((layer) => layer.visible).map((layer) => {
      const transform = `translate(${layer.x} ${layer.y}) rotate(${layer.rotation})`;
      const style = contourOffset > 0 ? `stroke="${layer.color}" stroke-width="${Math.max(0.3, contourOffset / 2)}" paint-order="stroke"` : "";
      if (layer.kind === "image") return `<image href="${escapeXml(layer.url ?? "")}" x="${-layer.width / 2}" y="${-layer.height / 2}" width="${layer.width}" height="${layer.height}" transform="${transform}" preserveAspectRatio="xMidYMid meet"/>`;
      if (layer.kind === "text") return `<text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-family="${escapeXml(layer.fontFamily ?? "Arial")}" font-size="${layer.height}" font-weight="${layer.fontWeight ?? 700}" fill="${layer.color}" ${style} transform="${transform}">${escapeXml(layer.content ?? "")}</text>`;
      if (layer.kind === "circle") return `<ellipse cx="0" cy="0" rx="${layer.width / 2}" ry="${layer.height / 2}" fill="${layer.color}" ${style} transform="${transform}"/>`;
      return `<rect x="${-layer.width / 2}" y="${-layer.height / 2}" width="${layer.width}" height="${layer.height}" fill="${layer.color}" ${style} transform="${transform}"/>`;
    }).join("\n");
    const marks = registrationMarks ? `<g fill="#000"><circle cx="8" cy="8" r="2"/><circle cx="${size.width - 8}" cy="8" r="2"/><circle cx="8" cy="${size.height - 8}" r="2"/><circle cx="${size.width - 8}" cy="${size.height - 8}" r="2"/></g>` : "";
    const box = weedBox ? `<rect x="3" y="3" width="${Math.max(1, size.width - 6)}" height="${Math.max(1, size.height - 6)}" fill="none" stroke="#111" stroke-width="0.3"/>` : "";
    const artwork = mirror ? `<g transform="translate(${size.width} 0) scale(-1 1)">${elements}${box}${marks}</g>` : `${elements}${box}${marks}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}mm" height="${size.height}mm" viewBox="0 0 ${size.width} ${size.height}"><title>${escapeXml(jobName)}</title>${artwork}</svg>`;
  }

  function markAuthoritative(project: Record<string, unknown> | null) {
    const fingerprint = project ? JSON.stringify(project) : null;
    authoritativeFingerprintRef.current = fingerprint;
    setAuthoritativeFingerprint(fingerprint);
  }

  function clearRecovery(message: string) {
    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    try {
      window.localStorage.removeItem(recoveryKey);
    } catch {
      // Saving to the shop remains authoritative even when local storage is unavailable.
    }
    setRecoveryDraft(null);
    setRecoveryMessage(message);
  }

  function selectMachineProfile(profile: DesignMachineProfile) {
    setMachineProfileId(profile.id);
    setBaudRate(profile.baudRate);
    setMirror(profile.mirrorDefault);
    if (device === "connected") {
      setDeviceMessage("Machine profile changed. Close and reconnect the serial port before sending with the new baud rate.");
    }
  }

  function updateMachineProfiles(profiles: DesignMachineProfile[]) {
    setAvailableMachineProfiles(profiles.length ? profiles : [fallbackMachineProfile]);
    if (!profiles.some((profile) => profile.id === machineProfileId)) {
      const replacement = profiles.find((profile) => profile.isDefault && profile.isActive) ?? profiles.find((profile) => profile.isActive) ?? profiles[0];
      if (replacement) selectMachineProfile(replacement);
    }
  }

  function useMachineBed(profile: DesignMachineProfile) {
    setSheet("custom");
    setCustomWidth(profile.bedWidthMm);
    setCustomHeight(profile.bedHeightMm);
    setMirror(profile.mirrorDefault);
  }

  async function saveProject() {
    setSaveStatus("saving");
    setSaveMessage("Saving to this shop…");
    try {
      const response = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: designJobId ?? undefined, title: jobName, customer: customer || undefined, machineProfile: machineProfile.name, canvas: projectSnapshot }),
      });
      const result = await response.json() as { design?: { id: string; versionNumber?: number; machineProfile?: DesignMachineProfile }; error?: string };
      if (!response.ok || !result.design) throw new Error(result.error ?? "Could not save this project.");
      setDesignJobId(result.design.id);
      markAuthoritative(projectSnapshot);
      setSaveStatus("saved");
      setSaveMessage(result.design.versionNumber ? `Saved version ${result.design.versionNumber} to this shop` : "Saved to this shop");
      clearRecovery("Shop save complete; local recovery draft cleared");
      router.refresh();
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage(error instanceof Error ? error.message : "Could not save this project.");
    }
  }

  function downloadBackup() {
    download(`${safeName(jobName)}.design.json`, JSON.stringify(projectSnapshot, null, 2), "application/json");
  }

  function applyProject(
    rawProject: Record<string, unknown>,
    projectId: string | null = null,
    authority: "saved" | "working" = projectId ? "saved" : "working",
  ) {
    const project = migrateDesignProject(rawProject);
    const nextSheet = typeof project.sheet === "string" && (project.sheet === "custom" || project.sheet in sheets) ? project.sheet as Sheet : "a3";
    const nextWidth = nextSheet === "custom" ? finiteNumber(project.customWidth, 300, 20, 2_000) : sheets[nextSheet].width;
    const nextHeight = nextSheet === "custom" ? finiteNumber(project.customHeight, 500, 20, 5_000) : sheets[nextSheet].height;
    const nextLayers = normalizedLayers(project.layers as unknown[], { width: nextWidth, height: nextHeight });
    const nextJobName = typeof project.jobName === "string" ? project.jobName.slice(0, 120) : "New design job";
    const nextCustomer = typeof project.customer === "string" ? project.customer.slice(0, 120) : "";
    const nextMaterial = typeof project.material === "string" && project.material in materialDetails ? project.material as Material : "htv";
    const nextCopies = Math.round(finiteNumber(project.copies, 1, 1, 100));
    const nextMirror = typeof project.mirror === "boolean" ? project.mirror : true;
    const nextShowGrid = typeof project.showGrid === "boolean" ? project.showGrid : true;
    const nextSnap = typeof project.snap === "boolean" ? project.snap : true;
    const nextWeedBox = typeof project.weedBox === "boolean" ? project.weedBox : true;
    const nextRegistrationMarks = typeof project.registrationMarks === "boolean" ? project.registrationMarks : false;
    const nextContourOffset = finiteNumber(project.contourOffset, 0, 0, 50);
    const requestedProfileId = typeof project.machineProfileId === "string" ? project.machineProfileId : "";
    const requestedProfileName = typeof project.machineProfile === "string" ? project.machineProfile : "Generic SVG cutter";
    const currentProfile = availableMachineProfiles.find((profile) => profile.id === requestedProfileId)
      ?? availableMachineProfiles.find((profile) => profile.name === requestedProfileName && profile.isActive);
    const savedSnapshot = machineProfileSnapshot(project.machineSettings, requestedProfileName, requestedProfileId || `snapshot-${projectId ?? id()}`);
    const nextMachineProfile = currentProfile ?? savedSnapshot
      ?? availableMachineProfiles.find((profile) => profile.isDefault && profile.isActive)
      ?? availableMachineProfiles.find((profile) => profile.isActive)
      ?? fallbackMachineProfile;
    if (!currentProfile && savedSnapshot) {
      setAvailableMachineProfiles((profiles) => profiles.some((profile) => profile.id === savedSnapshot.id) ? profiles : [...profiles, savedSnapshot]);
    }
    const nextSnapshot = {
      version: DESIGN_PROJECT_VERSION,
      jobName: nextJobName,
      customer: nextCustomer,
      material: nextMaterial,
      sheet: nextSheet,
      customWidth: nextWidth,
      customHeight: nextHeight,
      copies: nextCopies,
      mirror: nextMirror,
      showGrid: nextShowGrid,
      snap: nextSnap,
      weedBox: nextWeedBox,
      registrationMarks: nextRegistrationMarks,
      contourOffset: nextContourOffset,
      machineProfile: nextMachineProfile.name,
      machineProfileId: nextMachineProfile.id,
      machineSettings: nextMachineProfile,
      layers: nextLayers,
    };

    setPast([]);
    setFuture([]);
    setLayers(nextLayers);
    setSheet(nextSheet);
    setCustomWidth(nextWidth);
    setCustomHeight(nextHeight);
    setJobName(nextJobName);
    setCustomer(nextCustomer);
    setMaterial(nextMaterial);
    setCopies(nextCopies);
    setMirror(nextMirror);
    setShowGrid(nextShowGrid);
    setSnap(nextSnap);
    setWeedBox(nextWeedBox);
    setRegistrationMarks(nextRegistrationMarks);
    setContourOffset(nextContourOffset);
    setMachineProfileId(nextMachineProfile.id);
    setBaudRate(nextMachineProfile.baudRate);
    setDesignJobId(projectId);
    setSelection([]);
    if (authority === "saved") {
      markAuthoritative(nextSnapshot);
      setSaveStatus("saved");
      setSaveMessage("Saved project opened");
    } else {
      markAuthoritative(null);
      setSaveStatus("idle");
      setSaveMessage(projectId ? "Working copy opened; save changes to update this shop project" : "Backup opened; save it to this shop");
    }
  }

  function restoreRecovery() {
    if (!recoveryDraft) return;
    try {
      applyProject(recoveryDraft.project, recoveryDraft.designJobId, "working");
      setRecoveryDraft(null);
      setRecoveryMessage("Recovered draft restored; local autosave remains active");
    } catch (error) {
      setRecoveryMessage(error instanceof Error ? error.message : "Could not restore this recovered draft");
    }
  }

  function discardRecovery() {
    clearRecovery("Recovered draft discarded; local autosave remains active");
  }

  async function loadProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("Design backup must be smaller than 2 MB.");
      applyProject(JSON.parse(await file.text()) as Record<string, unknown>);
      setRecoveryDraft(null);
      setRecoveryMessage("Backup opened; local autosave remains active");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not open this design project.");
    }
    event.target.value = "";
  }

  async function openVersion(versionNumber: number) {
    if (!designJobId || openingVersion !== null) return;
    setOpeningVersion(versionNumber);
    setHistoryStatus(`Opening version ${versionNumber}…`);
    try {
      const response = await fetch(`/api/designs/${encodeURIComponent(designJobId)}/versions?version=${versionNumber}`);
      const result = await response.json() as { version?: { canvas: Record<string, unknown> }; error?: string };
      if (!response.ok || !result.version) throw new Error(result.error ?? "Could not open this version.");
      applyProject(result.version.canvas, designJobId, "working");
      setSaveStatus("idle");
      setSaveMessage(`Version ${versionNumber} opened; save changes to create a new current version`);
      setHistoryStatus(`Version ${versionNumber} opened from shop history`);
    } catch (error) {
      setHistoryStatus(error instanceof Error ? error.message : "Could not open this version.");
    } finally {
      setOpeningVersion(null);
    }
  }

  function exportManifest() {
    download(`${safeName(jobName)}-production.json`, JSON.stringify({
      jobName,
      customer: customer || null,
      createdAt: new Date().toISOString(),
      projectVersion: DESIGN_PROJECT_VERSION,
      material,
      sheet: { preset: sheet, widthMm: size.width, heightMm: size.height },
      output: { copies, mirror, weedBox, registrationMarks, contourOffsetMm: contourOffset },
      layers: layers.map(({ url, ...layer }) => ({ ...layer, embeddedArtwork: Boolean(url) })),
      productionChecks: { print: productionCheck, cutPaths: cutPathResult },
      heatPressNote: materialDetails[material].instruction,
      machineProfile,
      device: { state: device, name: deviceName, baudRate: machineProfile.baudRate },
    }, null, 2), "application/json");
  }

  async function prepareCutPaths() {
    if (cutExporting) return null;
    setCutExporting(true);
    setCutExportMessage("Preparing cutter paths and outlining editable text…");
    try {
      const outlined = await outlineDesignTextLayers(layers);
      const errors = [...cutPathResult.errors, ...outlined.errors];
      const outsideText = outlined.paths.filter((path) => path.points.some((point) => point.x < -0.01 || point.y < -0.01 || point.x > size.width + 0.01 || point.y > size.height + 0.01));
      if (outsideText.length) errors.push(`${outsideText.length} outlined text path${outsideText.length === 1 ? " is" : "s are"} outside the production sheet.`);
      if (errors.length) {
        const message = [...new Set(errors)].join(" ");
        setCutExportMessage(message);
        window.alert(message);
        return null;
      }
      const paths = [...cutPathResult.paths, ...outlined.paths];
      setCutExportMessage(outlined.converted
        ? `${outlined.converted} editable text layer${outlined.converted === 1 ? "" : "s"} outlined automatically. The downloaded cutter file contains paths only.`
        : "Cutter paths are ready. The downloaded file contains vector paths only.");
      return paths;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Automatic text outlining failed.";
      setCutExportMessage(message);
      window.alert(message);
      return null;
    } finally {
      setCutExporting(false);
    }
  }

  async function exportCutFile() {
    if (productionErrors.length || cutExporting) return;
    const paths = await prepareCutPaths();
    if (!paths) return;
    if (machineProfile.outputFormat === "HPGL") {
      download(`${safeName(jobName)}.plt`, buildCutHpgl({
        paths,
        sheet: size,
        mirror,
        origin: machineProfile.origin,
        unitsPerMm: machineProfile.unitsPerMm,
      }), "application/vnd.hp-hpgl");
      return;
    }
    if (machineProfile.outputFormat === "DXF") {
      download(`${safeName(jobName)}.dxf`, buildCutDxf({
        paths,
        sheet: size,
        mirror,
        origin: machineProfile.origin,
      }), "application/dxf");
      return;
    }
    download(`${safeName(jobName)}-cut.svg`, buildCutSvg({ paths, sheet: size, mirror }), "image/svg+xml");
  }

  function printDesign() {
    if (printBlocked) return;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      window.alert("Allow pop-ups for this site so the production print window can open.");
      return;
    }
    printWindow.document.write(buildPrintDocument({
      title: escapeXml(jobName),
      svg: svgDocument(),
      widthMm: size.width,
      heightMm: size.height,
      copies,
    }));
    printWindow.document.close();
  }

  async function connectDevice() {
    const serial = (navigator as NavigatorWithSerial).serial;
    if (!serial) {
      setDevice("unsupported");
      setDeviceName("Browser serial access unavailable");
      setDeviceMessage("Use current Chrome or Edge over HTTPS for serial cutters. System printing and SVG export still work in other modern browsers.");
      return;
    }
    setDevice("selecting");
    setDeviceMessage("Choose a serial cutter adapter. Standard printers continue through the operating-system print dialog.");
    try {
      const port = await serial.requestPort();
      await port.open({ baudRate });
      portRef.current = port;
      const info = port.getInfo?.();
      const parts = [
        info?.usbVendorId ? `VID ${info.usbVendorId.toString(16).toUpperCase()}` : "Serial device",
        info?.usbProductId ? `PID ${info.usbProductId.toString(16).toUpperCase()}` : "",
      ].filter(Boolean);
      setDevice("connected");
      setDeviceName(parts.join(" · "));
      setDeviceMessage(`Port detected at ${baudRate} baud for ${machineProfile.name}. Only validated vector paths can be sent directly.`);
    } catch (error) {
      setDevice("error");
      setDeviceName("No device connected");
      setDeviceMessage(error instanceof Error && error.name !== "NotFoundError" ? error.message : "Device selection was cancelled.");
    }
  }

  async function sendHpglJob() {
    const port = portRef.current;
    if (!port?.writable) {
      setDevice("error");
      setDeviceMessage("The selected serial port is not writable. Reconnect the cutter and try again.");
      return;
    }
    if (machineProfile.outputFormat !== "HPGL") {
      setDevice("error");
      setDeviceMessage("Select an active HPGL machine profile before direct serial sending.");
      return;
    }
    if (productionErrors.length) {
      setDevice("error");
      setDeviceMessage(productionErrors.join(" "));
      return;
    }
    const paths = await prepareCutPaths();
    if (!paths) return;
    const writer = port.writable.getWriter();
    try {
      const hpgl = buildCutHpgl({
        paths,
        sheet: size,
        mirror,
        origin: machineProfile.origin,
        unitsPerMm: machineProfile.unitsPerMm,
      });
      await writer.write(new TextEncoder().encode(hpgl));
      setDevice("connected");
      setDeviceMessage(`Vector job sent at ${baudRate} baud. Confirm cutter movement, origin and material loading before leaving the machine unattended.`);
    } catch (error) {
      setDevice("error");
      setDeviceMessage(error instanceof Error ? error.message : "The cutter did not accept the serial job.");
    } finally {
      writer.releaseLock();
    }
  }

  async function disconnectDevice() {
    try {
      await portRef.current?.close();
    } catch {
      // The device may already be disconnected.
    }
    portRef.current = null;
    setDevice("not-configured");
    setDeviceName("No output device selected");
    setDeviceMessage("The serial port is closed. SVG export and system printing remain available.");
  }

  function renderSelectionInspector() {
    return (
      <div className="space-y-4">
        <section className="panel p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Selection</h3><span className="text-xs text-slate-500">{selectedIds.length} selected</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={groupSelection} disabled={selectedIds.length < 2}><Layers3 size={16} /> Group selected</Button>
            <Button variant="outline" onClick={ungroupSelection} disabled={!canUngroup}><X size={16} /> Ungroup selected</Button>
            <Button variant="outline" onClick={duplicateSelection} disabled={!selectedIds.length}><Copy size={16} /> Duplicate selected</Button>
            <Button variant="outline" onClick={deleteSelection} disabled={!selectedIds.length}><Trash2 size={16} /> Delete selected</Button>
          </div>
          <Button className="mt-2 w-full" variant="outline" onClick={() => setSelection([])} disabled={!selectedIds.length}>Clear selection</Button>
          <p className="mt-3 text-xs leading-5 text-slate-500">Groups select and move as one unit. One unlocked layer also shows corner resize and rotation handles on the sheet.</p>
        </section>

        <section className="panel p-4">
          <h3 className="font-semibold">Selected layer</h3>
          {selectedIds.length > 1 ? <p className="mt-3 rounded-lg bg-[#f6f4ef] p-3 text-sm text-slate-500">{selectedIds.length} layers are selected. Use the Selection controls for group actions, or clear the selection and choose one layer for exact properties.</p> : selected ? <div className="mt-3 space-y-2">
            <input className="field" maxLength={120} value={selected.name} onChange={(event) => updateLayer(selected.id, { name: event.target.value })} aria-label="Layer name" />
            {selected.kind === "text" ? <><textarea className="field min-h-16" maxLength={500} value={selected.content ?? ""} onChange={(event) => updateLayer(selected.id, { content: event.target.value, name: event.target.value.slice(0, 24) || "Text" })} /><select className="field" value={selected.fontFamily ?? "Arial"} onChange={(event) => updateLayer(selected.id, { fontFamily: event.target.value })}>{allowedFonts.map((font) => <option key={font}>{font}</option>)}</select></> : null}
            <div className="grid grid-cols-2 gap-2"><NumberField label="X (mm)" value={selected.x} min={0} max={size.width} onChange={(x) => updateLayer(selected.id, { x: snapValue(x) })} /><NumberField label="Y (mm)" value={selected.y} min={0} max={size.height} onChange={(y) => updateLayer(selected.id, { y: snapValue(y) })} /><NumberField label="Width (mm)" value={selected.width} min={1} max={size.width} onChange={(width) => updateLayer(selected.id, { width })} /><NumberField label="Height (mm)" value={selected.height} min={1} max={size.height} onChange={(height) => updateLayer(selected.id, { height })} /></div>
            <NumberField label="Rotation (degrees)" value={selected.rotation} min={-360} max={360} onChange={(rotation) => updateLayer(selected.id, { rotation })} />
            {selected.kind !== "image" ? <label className="block text-xs font-semibold text-slate-600">Colour<input className="mt-1 h-10 w-full rounded border border-[#ded8cd]" type="color" value={selected.color} onChange={(event) => updateLayer(selected.id, { color: event.target.value })} /></label> : null}
            {selected.locked ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Unlock this layer before using canvas resize or rotation handles.</p> : <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-950">Drag a corner to resize. Image and text proportions stay fixed; hold Shift to preserve proportions for shapes. Drag the round handle to rotate and hold Shift for 15° steps.</p>}
          </div> : <p className="mt-3 rounded-lg bg-[#f6f4ef] p-3 text-sm text-slate-500">Select a layer on the sheet or in the layer list to set its exact position and size.</p>}
        </section>
      </div>
    );
  }

  const deviceTone = device === "connected"
    ? "border-emerald-200 bg-emerald-50"
    : device === "unsupported" || device === "error"
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-slate-50";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-white shadow-xl sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#f4b942]"><Scissors size={15} /> Professional production workspace</div>
            <h2 className="mt-2 text-xl font-semibold sm:text-2xl">Design on the transfer material—not on a jersey mockup.</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">Every coordinate is stored in millimetres. Multi-select and groups preserve spacing while version history protects every authoritative shop save.</p>
            <p className={`mt-2 text-xs font-semibold ${saveStatus === "error" ? "text-red-300" : saveStatus === "saved" ? "text-emerald-300" : "text-slate-400"}`}>{saveMessage}</p>
            <p className="mt-1 text-xs font-medium text-cyan-200">{recoveryMessage}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={undo} disabled={!past.length}><Undo2 size={16} /> Undo</Button>
            <Button variant="outline" onClick={redo} disabled={!future.length}><Redo2 size={16} /> Redo</Button>
            <Button variant="outline" onClick={saveProject} disabled={saveStatus === "saving" || Boolean(recoveryDraft)}><Save size={16} /> {saveStatus === "saving" ? "Saving…" : designJobId ? "Save changes" : "Save project"}</Button>
            <Button variant="outline" onClick={downloadBackup}><Download size={16} /> Backup</Button>
            <Button variant="outline" onClick={() => projectInputRef.current?.click()} disabled={Boolean(recoveryDraft)}><Upload size={16} /> Open backup</Button>
            <input ref={projectInputRef} className="hidden" type="file" accept="application/json,.json" onChange={loadProject} />
          </div>
        </div>
      </section>

      {recoveryDraft ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm" role="alert">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2"><RotateCcw size={19} /><h3 className="font-semibold">Recovered work found</h3></div>
              <p className="mt-2 text-sm leading-6">A local draft from {recoveryTime(recoveryDraft.savedAt)} is newer than the shop copy. Restore it before editing, or discard it and continue from the current workspace.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={restoreRecovery}><RotateCcw size={16} /> Restore recovered draft</Button>
              <Button variant="outline" onClick={discardRecovery}><X size={16} /> Discard</Button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[310px_minmax(0,1fr)_340px]">
        <aside className="space-y-4">
          <section className="panel p-4">
            <h3 className="font-semibold">Job details</h3>
            {savedDesigns.length ? <label className="mt-3 block text-xs font-semibold text-slate-600">Open shop project<select className="field mt-1" value="" disabled={Boolean(recoveryDraft)} onChange={(event) => { const saved = savedDesigns.find((item) => item.id === event.target.value); if (saved) applyProject(saved.canvas, saved.id); }}><option value="">Select a saved project</option>{savedDesigns.map((design) => <option key={design.id} value={design.id}>{design.title}</option>)}</select></label> : null}
            <label className="mt-3 block text-xs font-semibold text-slate-600">Job name<input aria-label="Job name" className="field mt-1" maxLength={120} value={jobName} onChange={(event) => setJobName(event.target.value)} /></label>
            <label className="mt-3 block text-xs font-semibold text-slate-600">Customer or team<input className="field mt-1" maxLength={120} value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Links on one exact customer match" /></label>
          </section>

          <section className="panel p-4">
            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><History size={18} /><h3 className="font-semibold">Version history</h3></div><span className="text-xs text-slate-500">{versions.length}</span></div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{historyStatus}</p>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {versions.map((version) => (
                <div key={version.id} className="rounded-lg border border-[#ded8cd] bg-white p-3 text-xs">
                  <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">Version {version.versionNumber}</p><p className="mt-1 text-slate-500">{version.sourceLabel} · {version.createdByName}</p><p className="mt-1 text-slate-500">{historyTime(version.createdAt)}</p></div><Button variant="outline" onClick={() => openVersion(version.versionNumber)} disabled={openingVersion !== null || Boolean(recoveryDraft)}>{openingVersion === version.versionNumber ? "Opening…" : `Open version ${version.versionNumber}`}</Button></div>
                </div>
              ))}
              {designJobId && !versions.length ? <p className="rounded-lg bg-[#f6f4ef] p-3 text-xs text-slate-500">The next successful save will create the first immutable version.</p> : null}
            </div>
          </section>

          <section className="panel p-4">
            <div className="flex items-center gap-2"><ImagePlus size={18} /><h3 className="font-semibold">Insert artwork</h3></div>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-semibold hover:border-[var(--shop-primary)]"><ImagePlus size={18} /> Add pictures or SVGs<input className="hidden" type="file" accept="image/*,.svg" multiple onChange={uploadArtwork} /></label>
            {uploadMessage ? <p className="mt-2 text-xs font-medium text-slate-600">{uploadMessage}</p> : null}
            <div className="mt-3 flex gap-2"><input className="field min-w-0" maxLength={500} value={newText} onChange={(event) => setNewText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addText(); } }} placeholder="Name, number, text…" /><Button variant="outline" onClick={addText} aria-label="Add text"><Type size={16} /></Button></div>
            <div className="mt-2 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => addShape("rectangle")}><Square size={16} /> Rectangle</Button><Button variant="outline" onClick={() => addShape("circle")}><Circle size={16} /> Circle</Button></div>
          </section>

          <section className="panel p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Layers3 size={18} /><h3 className="font-semibold">Layers</h3></div><span className="text-xs text-slate-500">{layers.length}</span></div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Click a layer to select its group. Hold Shift, Ctrl or Command to add or remove selections.</p>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {[...layers].reverse().map((layer) => {
                const selectedLayer = selectedSet.has(layer.id);
                return (
                  <div key={layer.id} className={`rounded-lg border p-2 ${selectedLayer ? "border-[var(--shop-primary)] bg-emerald-50" : "border-[#ded8cd] bg-white"}`}>
                    <button type="button" aria-pressed={selectedLayer} className="flex w-full items-center gap-2 text-left text-sm font-semibold" onClick={(event: ReactMouseEvent<HTMLButtonElement>) => chooseLayer(layer, event.shiftKey || event.ctrlKey || event.metaKey)}><span className={`h-3 w-3 rounded-sm border ${selectedLayer ? "border-emerald-700 bg-emerald-600" : "border-slate-400 bg-white"}`} /><span className="min-w-0 flex-1 truncate">{layer.name}</span>{layer.groupId ? <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800">Group</span> : null}</button>
                    <div className="mt-2 flex gap-1">
                      <button type="button" aria-label="Toggle visibility" className="rounded p-1 hover:bg-slate-100" onClick={() => updateLayer(layer.id, { visible: !layer.visible })}>{layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                      <button type="button" aria-label="Toggle lock" className="rounded p-1 hover:bg-slate-100" onClick={() => updateLayer(layer.id, { locked: !layer.locked })}>{layer.locked ? <Lock size={15} /> : <Unlock size={15} />}</button>
                      <button type="button" aria-label="Duplicate" className="rounded p-1 hover:bg-slate-100" onClick={() => duplicateLayer(layer)}><Copy size={15} /></button>
                      <button type="button" aria-label="Move up" className="rounded p-1 hover:bg-slate-100" onClick={() => moveLayer(layer.id, 1)}><ChevronUp size={15} /></button>
                      <button type="button" aria-label="Move down" className="rounded p-1 hover:bg-slate-100" onClick={() => moveLayer(layer.id, -1)}><ChevronDown size={15} /></button>
                      <button type="button" aria-label="Delete" className="ml-auto rounded p-1 text-red-600 hover:bg-red-50" onClick={() => { checkpoint(layers.filter((item) => item.id !== layer.id)); setSelection(selectedIds.filter((selectedId) => selectedId !== layer.id), primarySelectedId === layer.id ? null : primarySelectedId); }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
              {!layers.length ? <p className="rounded-lg bg-[#f6f4ef] p-4 text-sm text-slate-500">Add pictures, text, or shapes. Each item becomes an editable layer.</p> : null}
            </div>
          </section>
        </aside>

        <main className="panel min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded8cd] bg-white px-4 py-3">
            <div><p className="text-sm font-semibold">Material workspace</p><p className="text-xs text-slate-500">{size.width} × {size.height} mm · {copies} cop{copies === 1 ? "y" : "ies"} · {mirror ? "output mirrored" : "normal output"}</p></div>
            <div className="flex flex-wrap gap-2"><Button className="xl:hidden" variant="outline" aria-label="Open mobile inspector" onClick={() => setInspectorOpen(true)}><PanelBottomOpen size={16} /> Inspector</Button><Button variant="outline" onClick={() => setShowGrid(!showGrid)}><Grid3X3 size={16} /> {showGrid ? "Grid on" : "Grid off"}</Button><Button variant="outline" onClick={() => setSnap(!snap)}>{snap ? "Snap 5 mm" : "Free move"}</Button></div>
          </div>
          <div className="flex min-h-[430px] items-center justify-center overflow-auto bg-slate-200 p-3 sm:min-h-[620px] sm:p-6">
            <svg
              ref={canvasRef}
              viewBox={`0 0 ${size.width} ${size.height}`}
              className="h-auto max-h-[760px] w-full max-w-[760px] touch-none border border-slate-500 bg-white shadow-2xl"
              style={{ aspectRatio: `${size.width} / ${size.height}` }}
              onPointerMove={drag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerDown={(event) => { if (event.target === event.currentTarget) setSelection([]); }}
              aria-label="Production material canvas"
            >
              <defs>{showGrid ? <pattern id={gridId} width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#dbe2ea" strokeWidth="0.25" /></pattern> : null}</defs>
              {showGrid ? <rect x="0" y="0" width={size.width} height={size.height} fill={`url(#${gridId})`} /> : null}
              {weedBox ? <rect x="3" y="3" width={Math.max(1, size.width - 6)} height={Math.max(1, size.height - 6)} fill="none" stroke="#475569" strokeWidth="0.35" strokeDasharray="2 2" /> : null}
              {registrationMarks ? <g fill="#000">{[[8, 8], [size.width - 8, 8], [8, size.height - 8], [size.width - 8, size.height - 8]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2" />)}</g> : null}
              {layers.map((layer) => layer.visible ? (
                <g
                  key={layer.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select and move ${layer.name}`}
                  aria-pressed={selectedSet.has(layer.id)}
                  transform={`translate(${layer.x} ${layer.y}) rotate(${layer.rotation})`}
                  onPointerDown={(event) => startDrag(event, layer)}
                  onKeyDown={(event) => nudgeLayer(event, layer)}
                  className={layer.locked ? "cursor-not-allowed" : "cursor-move"}
                >
                  {layer.kind === "image" && layer.url ? <image href={layer.url} x={-layer.width / 2} y={-layer.height / 2} width={layer.width} height={layer.height} preserveAspectRatio="xMidYMid meet" /> : null}
                  {layer.kind === "text" ? <text x="0" y="0" textAnchor="middle" dominantBaseline="middle" fontFamily={layer.fontFamily} fontWeight={layer.fontWeight} fontSize={layer.height} fill={layer.color}>{layer.content}</text> : null}
                  {layer.kind === "rectangle" ? <rect x={-layer.width / 2} y={-layer.height / 2} width={layer.width} height={layer.height} fill={layer.color} /> : null}
                  {layer.kind === "circle" ? <ellipse cx="0" cy="0" rx={layer.width / 2} ry={layer.height / 2} fill={layer.color} /> : null}
                  {selectedSet.has(layer.id) ? <rect x={-layer.width / 2} y={-layer.height / 2} width={layer.width} height={layer.height} fill="none" stroke={primarySelectedId === layer.id ? "#0284c7" : "#059669"} strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={primarySelectedId === layer.id ? "4 3" : "2 2"} /> : null}
                  {selectedIds.length === 1 && primarySelectedId === layer.id && !layer.locked ? (
                    <g aria-label={`Transform handles for ${layer.name}`}>
                      <line x1="0" y1={-layer.height / 2} x2="0" y2={-layer.height / 2 - rotationHandleOffset} stroke="#0284c7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      <g role="button" tabIndex={0} aria-label={`Rotate ${layer.name}`} transform={`translate(0 ${-layer.height / 2 - rotationHandleOffset})`} onPointerDown={(event) => startRotate(event, layer)} className="cursor-grab">
                        <circle r={handleRadius * 1.9} fill="transparent" />
                        <circle r={handleRadius} fill="#ffffff" stroke="#0284c7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <path d={`M ${-handleRadius / 2} 0 A ${handleRadius / 2} ${handleRadius / 2} 0 1 1 ${handleRadius / 2} 0`} fill="none" stroke="#0284c7" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
                      </g>
                      {transformHandles.map(({ handle, x, y }) => (
                        <g key={handle} role="button" tabIndex={0} aria-label={`Resize ${layer.name} from ${handle.replace("-", " ")}`} transform={`translate(${x * layer.width / 2} ${y * layer.height / 2})`} onPointerDown={(event) => startResize(event, layer, handle)} className={handle === "north-west" || handle === "south-east" ? "cursor-nwse-resize" : "cursor-nesw-resize"}>
                          <circle r={handleRadius * 1.9} fill="transparent" />
                          <rect x={-handleRadius} y={-handleRadius} width={handleRadius * 2} height={handleRadius * 2} rx={handleRadius / 3} fill="#ffffff" stroke="#0284c7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        </g>
                      ))}
                    </g>
                  ) : null}
                </g>
              ) : null)}
              {!layers.length ? <g fill="#94a3b8" textAnchor="middle"><text x={size.width / 2} y={size.height / 2 - 4} fontSize={Math.max(8, Math.min(18, size.width / 16))} fontWeight="700">Insert artwork, text, or shapes</text><text x={size.width / 2} y={size.height / 2 + 10} fontSize={Math.max(5, Math.min(10, size.width / 28))}>The sheet is the real production surface</text></g> : null}
            </svg>
          </div>
          <div className="border-t border-[#ded8cd] bg-white px-4 py-3 text-xs text-slate-600">The editor stays unmirrored for accurate positioning. Drag a selected layer to move it; one unlocked layer also shows resize and rotation handles.</div>
        </main>

        <aside className="space-y-4">
          <div className="hidden xl:block">{renderSelectionInspector()}</div>

          <MachineProfilePanel
            profiles={availableMachineProfiles}
            selectedId={machineProfile.id}
            canManage={canManageMachineProfiles}
            onSelect={selectMachineProfile}
            onProfilesChange={updateMachineProfiles}
            onUseBed={useMachineBed}
          />

          <section className="panel p-4">
            <h3 className="font-semibold">Material and cut setup</h3>
            <label className="mt-3 block text-xs font-semibold text-slate-600">Material<select className="field mt-1" value={material} onChange={(event) => { const value = event.target.value as Material; setMaterial(value); setMirror(materialDetails[value].defaultMirror); }}>{Object.entries(materialDetails).map(([value, detail]) => <option key={value} value={value}>{detail.label}</option>)}</select></label>
            <label className="mt-3 block text-xs font-semibold text-slate-600">Sheet or roll area<select className="field mt-1" value={sheet} onChange={(event) => setSheet(event.target.value as Sheet)}>{Object.entries(sheets).map(([value, detail]) => <option key={value} value={value}>{detail.label} · {detail.width}×{detail.height} mm</option>)}<option value="custom">Custom dimensions</option></select></label>
            {sheet === "custom" ? <div className="mt-2 grid grid-cols-2 gap-2"><NumberField label="Width mm" value={customWidth} min={20} max={2_000} onChange={setCustomWidth} /><NumberField label="Height mm" value={customHeight} min={20} max={5_000} onChange={setCustomHeight} /></div> : null}
            <div className="mt-2 grid grid-cols-2 gap-2"><NumberField label="Copies" value={copies} min={1} max={100} onChange={(value) => setCopies(Math.round(value))} /><NumberField label="Contour (mm)" value={contourOffset} min={0} max={50} step={0.1} onChange={setContourOffset} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Toggle label="Mirror output" checked={mirror} onChange={setMirror} /><Toggle label="Weed box" checked={weedBox} onChange={setWeedBox} /><Toggle label="Registration marks" checked={registrationMarks} onChange={setRegistrationMarks} /><Toggle label="Snap to grid" checked={snap} onChange={setSnap} /></div>
            <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-950">{materialDetails[material].instruction}</div>
          </section>

          <section className={`rounded-lg border p-4 ${deviceTone}`}>
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Usb size={18} /><h3 className="font-semibold">Device readiness</h3></div>{device === "connected" ? <CheckCircle2 className="text-emerald-600" size={19} /> : <AlertTriangle className="text-amber-600" size={19} />}</div>
            <p className="mt-2 text-sm font-semibold">{deviceName}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{deviceMessage}</p>
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600"><p className="font-semibold text-slate-900">{machineProfile.name}</p><p>{machineProfile.baudRate} baud · {machineProfile.unitsPerMm} units/mm · {machineProfile.origin === "BOTTOM_LEFT" ? "bottom-left" : "top-left"} origin</p></div>
            {device === "connected" ? <Button className="mt-3 w-full" variant="outline" onClick={disconnectDevice}>Close serial port</Button> : <Button className="mt-3 w-full" variant="outline" onClick={connectDevice} disabled={device === "selecting"}><Usb size={16} /> {device === "selecting" ? "Selecting device…" : "Connect serial cutter"}</Button>}
          </section>

          <section className="panel p-4">
            <div className="flex items-center gap-2"><Download size={18} /><h3 className="font-semibold">Production output</h3></div>
            <div className="mt-3 rounded-lg bg-[#f6f4ef] p-3 text-xs leading-5 text-slate-600"><p className="font-semibold text-slate-900">{machineProfile.name}</p><p>{machineProfile.outputFormat.replace("_", " ")} · {machineProfile.bedWidthMm} × {machineProfile.bedHeightMm} mm</p>{!machineProfile.isActive ? <p className="mt-1 font-semibold text-amber-700">Historical profile snapshot. Select an active shop profile before saving.</p> : null}</div>
            {productionErrors.length ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"><p className="font-semibold">Fix before production</p><ul className="mt-1 list-disc pl-4">{productionErrors.map((issue) => <li key={issue}>{issue}</li>)}</ul></div> : null}
            {productionWarnings.length ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><p className="font-semibold">Operator checks</p><ul className="mt-1 list-disc pl-4">{productionWarnings.map((issue) => <li key={issue}>{issue}</li>)}</ul></div> : null}
            <div className="mt-3 grid gap-2">
              {machineProfile.outputFormat === "PRINT_RIP"
                ? <Button disabled={printBlocked} onClick={() => download(`${safeName(jobName)}.svg`, svgDocument(), "image/svg+xml")}><Scissors size={16} /> Export full-colour SVG</Button>
                : <Button disabled={productionBlocked || cutExporting} onClick={exportCutFile}><Scissors size={16} /> {cutExporting ? "Preparing cutter paths…" : `Export ${machineProfile.outputFormat.replace("_", " ")}`}</Button>}
              {machineProfile.outputFormat === "HPGL" ? <Button variant="secondary" disabled={productionBlocked || cutExporting || device !== "connected"} onClick={sendHpglJob}><Send size={16} /> Send validated paths to cutter</Button> : null}
              <Button variant="secondary" disabled={printBlocked} onClick={printDesign}><Printer size={16} /> Print {copies} cop{copies === 1 ? "y" : "ies"}</Button>
              <Button variant="outline" onClick={exportManifest}><MonitorCog size={16} /> Export job manifest</Button>
            </div>
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold leading-4 text-emerald-900">{cutExportMessage}</p>
            <p className="mt-2 text-[11px] leading-4 text-slate-500">Editable text stays editable in the saved project. During cutter export, the browser automatically converts the rendered letters into closed vector outlines. Raster pictures still require tracing before they can be cut.</p>
          </section>
        </aside>
      </div>

      {inspectorOpen ? (
        <div className="fixed inset-0 z-50 flex items-end xl:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/55" aria-label="Close mobile inspector overlay" onClick={() => setInspectorOpen(false)} />
          <section role="dialog" aria-modal="true" aria-label="Layer inspector" className="relative z-10 max-h-[82vh] w-full overflow-y-auto rounded-t-2xl border border-slate-300 bg-[#f6f4ef] p-4 shadow-2xl">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between border-b border-[#ded8cd] bg-white px-4 py-3">
              <div><p className="text-sm font-semibold">Layer inspector</p><p className="text-xs text-slate-500">Exact millimetre controls for the current selection</p></div>
              <Button variant="outline" aria-label="Close mobile inspector" onClick={() => setInspectorOpen(false)}><X size={16} /> Close</Button>
            </div>
            {renderSelectionInspector()}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  return <label className="block text-xs font-semibold text-slate-600">{label}<input className="field mt-1" type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, next))); }} /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-2 rounded-lg border border-[#ded8cd] bg-white p-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}
