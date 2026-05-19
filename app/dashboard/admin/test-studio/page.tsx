"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { parseCsvRows, rowsToObjects } from "@/lib/csv";

type TestModule = "LISTENING" | "READING" | "WRITING" | "SPEAKING";
type VariantInput = "ACADEMIC" | "GENERAL";
type DifficultyInput = "EASY" | "MEDIUM" | "HARD";
type StatusChip = "DRAFT" | "READY" | "LIVE" | "ARCHIVED";
type MappingModule = "LISTENING" | "READING";
type ListeningAudioMode = "single_full_audio" | "sequential_section_audio";

type TestRow = {
  id: string;
  title: string;
  module: TestModule;
  variant: VariantInput;
  difficulty: DifficultyInput;
  durationMins: number;
  totalQuestions: number;
  isActive: boolean;
  isPractice: boolean;
  description?: string | null;
  attemptsCount?: number;
};

type TestQuestionDetail = {
  id: string;
  type?: string | null;
  sourceBankItemId?: string | null;
  sourcePassageId?: string | null;
  questionText?: string | null;
};

type TestSectionDetail = {
  id: string;
  title: string;
  order: number;
  passage?: string | null;
  audioUrl?: string | null;
  sourcePassageId?: string | null;
  questions?: TestQuestionDetail[];
};

type TestDetail = {
  id: string;
  module: TestModule;
  sourceConfig?: unknown;
  sections: TestSectionDetail[];
};

type PassageMedia = {
  id: string;
  type: "IMAGE" | "AUDIO";
  url: string;
  label?: string | null;
  order: number;
};

type PassageRow = {
  id: string;
  title: string;
  content?: string | null;
  module: "READING" | "LISTENING" | "WRITING";
  sectionPart: number;
  difficulty: DifficultyInput;
  linkedQuestions: number;
  media: PassageMedia[];
};

type BankQuestion = {
  id: string;
  questionText: string;
  type: string;
  options?: Array<{
    id: string;
    label: string;
    text: string;
  }>;
};

type PartState = {
  part: number;
  passageId: string;
  selectedQuestionIds: string[];
};

type CsvDraftRow = Record<string, string>;

type CreatePayload = {
  title: string;
  module: TestModule;
  variant: VariantInput;
  difficulty: DifficultyInput;
  durationMins: number;
  isPractice: boolean;
  description: string;
};

const DEFAULT_SECTION_TRANSITION_MESSAGE =
  "Now, starting another section, be prepared.";

const STATUS_CLS: Record<StatusChip, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  READY: "bg-amber-100 text-amber-700",
  LIVE: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-rose-100 text-rose-700",
};

const REQUIRED_CSV_HEADERS = ["question_text", "question_type"];

const CSV_TEMPLATE_HEADERS = [
  "question_text",
  "question_type",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_answer",
  "accepted_answers",
  "explanation",
  "module",
  "section_part",
  "passage_id",
  "difficulty",
  "points",
  "question_image_url",
  "question_audio_url",
  "passage_title",
];

const CSV_TEMPLATE_SAMPLE = [
  "Sample question",
  "MULTIPLE_CHOICE",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "A",
  "A|Option A",
  "Reason",
  "READING",
  "1",
  "",
  "MEDIUM",
  "1",
  "",
  "",
  "",
];

const EMPTY_CREATE: CreatePayload = {
  title: "",
  module: "READING",
  variant: "ACADEMIC",
  difficulty: "MEDIUM",
  durationMins: 60,
  isPractice: true,
  description: "",
};

function inferTestStatus(test: TestRow): StatusChip {
  if (!test.isActive) return "ARCHIVED";
  if (test.module === "WRITING" && test.totalQuestions >= 2) return "LIVE";
  if (test.module === "SPEAKING" && test.totalQuestions >= 3) return "LIVE";
  if (
    (test.module === "READING" || test.module === "LISTENING") &&
    test.totalQuestions >= 40
  ) {
    return "LIVE";
  }
  if (test.totalQuestions > 0) return "READY";
  return "DRAFT";
}

function isMappingModule(testModule: TestModule): testModule is MappingModule {
  return testModule === "READING" || testModule === "LISTENING";
}

function questionLimitPerPart(testModule: MappingModule): number {
  return testModule === "READING" ? 14 : 10;
}

function emptyPartsFor(testModule: MappingModule): PartState[] {
  const count = testModule === "READING" ? 3 : 4;
  return Array.from({ length: count }, (_, idx) => ({
    part: idx + 1,
    passageId: "",
    selectedQuestionIds: [],
  }));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeCsvRow(row: Record<string, string>): CsvDraftRow {
  const out: CsvDraftRow = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.trim().toLowerCase()] = value ?? "";
  }
  return out;
}

function csvFromRows(headers: string[], rows: CsvDraftRow[]): string {
  const allHeaders = headers.length ? headers : Object.keys(rows[0] || {});
  const escape = (value: string) => {
    const safe = String(value ?? "");
    const escaped = safe.replace(/"/g, '""');
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  };
  const headerLine = allHeaders.map((header) => escape(header)).join(",");
  const body = rows.map((row) =>
    allHeaders.map((header) => escape(row[header] || "")).join(","),
  );
  return [headerLine, ...body].join("\n");
}

function passageHint(
  row: CsvDraftRow,
  passages: PassageRow[],
): { suggestedPassageId: string | null; reason: string | null } {
  const moduleName = (row.module || "").trim().toUpperCase();
  const sectionPart = Number(row.section_part || "");
  if (!moduleName || !Number.isFinite(sectionPart)) {
    return { suggestedPassageId: null, reason: null };
  }
  const match = passages.find(
    (passage) =>
      passage.module === moduleName && passage.sectionPart === sectionPart,
  );
  if (!match) return { suggestedPassageId: null, reason: null };
  return {
    suggestedPassageId: match.id,
    reason: `Suggested from ${moduleName} Part ${sectionPart}`,
  };
}

function validateCsvRows(rows: CsvDraftRow[], passages: PassageRow[]) {
  const passageIds = new Set(passages.map((passage) => passage.id));
  return rows.map((row) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    const questionText = (row.question_text || "").trim();
    const questionType = (row.question_type || "").trim();
    const passageId = (row.passage_id || "").trim();
    const moduleName = (row.module || "").trim();
    const sectionPart = (row.section_part || "").trim();

    if (!questionText) issues.push("Missing question_text");
    if (!questionType) issues.push("Missing question_type");

    if (!passageId) {
      warnings.push("passage_id missing");
    } else if (!passageIds.has(passageId)) {
      issues.push("Invalid passage_id");
    }

    if (!moduleName) warnings.push("module missing");
    if (!sectionPart) warnings.push("section_part missing");

    return {
      issues,
      warnings,
      isValid: issues.length === 0,
    };
  });
}

export default function TestStudioPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingShell, setSavingShell] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyTestId, setBusyTestId] = useState<string | null>(null);
  const [loadingPassageQuestions, setLoadingPassageQuestions] = useState<
    string | null
  >(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [tests, setTests] = useState<TestRow[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [newShellId, setNewShellId] = useState<string | null>(null);
  const [detailByTestId, setDetailByTestId] = useState<
    Record<string, TestDetail>
  >({});

  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<"ALL" | TestModule>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | StatusChip>("ALL");

  const [createForm, setCreateForm] = useState<CreatePayload>(EMPTY_CREATE);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDurationMins, setEditDurationMins] = useState(60);
  const [editVariant, setEditVariant] = useState<VariantInput>("ACADEMIC");
  const [editDifficulty, setEditDifficulty] =
    useState<DifficultyInput>("MEDIUM");
  const [editIsPractice, setEditIsPractice] = useState(true);

  const [publishTitle, setPublishTitle] = useState("");
  const [archiveShellAfterPublish, setArchiveShellAfterPublish] =
    useState(true);

  const [passages, setPassages] = useState<PassageRow[]>([]);
  const [passagesLoading, setPassagesLoading] = useState(true);
  const [questionCache, setQuestionCache] = useState<
    Record<string, BankQuestion[]>
  >({});
  const questionCacheRef = useRef<Record<string, BankQuestion[]>>({});
  const [parts, setParts] = useState<PartState[]>([]);

  const [listeningAudioMode, setListeningAudioMode] =
    useState<ListeningAudioMode>("sequential_section_audio");
  const [listeningSectionPauseSeconds, setListeningSectionPauseSeconds] =
    useState(10);
  const [
    listeningSectionTransitionMessage,
    setListeningSectionTransitionMessage,
  ] = useState(DEFAULT_SECTION_TRANSITION_MESSAGE);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvDraftRow[]>([]);
  const [allowInvalidOverride, setAllowInvalidOverride] = useState(false);
  const [defaultPassageId, setDefaultPassageId] = useState("");
  const [csvSearch, setCsvSearch] = useState("");
  const [csvModuleFilter, setCsvModuleFilter] = useState("ALL");
  const [csvSectionFilter, setCsvSectionFilter] = useState("ALL");
  const [csvDifficultyFilter, setCsvDifficultyFilter] = useState("ALL");

  useEffect(() => {
    questionCacheRef.current = questionCache;
  }, [questionCache]);

  const loadTests = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/tests?fresh=1", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load test shells");
      const data = (await res.json()) as { tests?: TestRow[] };
      const nextTests = Array.isArray(data.tests) ? data.tests : [];
      setTests(nextTests);
      setSelectedTestId((prev) => {
        if (prev && nextTests.some((row) => row.id === prev)) return prev;
        return nextTests[0]?.id || "";
      });
    } catch (err) {
      setTests([]);
      setError(err instanceof Error ? err.message : "Failed to load tests");
    } finally {
      if (showSkeleton) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadPassages = useCallback(async () => {
    setPassagesLoading(true);
    try {
      const res = await fetch("/api/admin/passages", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as {
        passages?: PassageRow[];
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load passages");
      }
      setPassages(Array.isArray(data?.passages) ? data.passages : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load passages");
    } finally {
      setPassagesLoading(false);
    }
  }, []);

  const loadTestDetail = useCallback(
    async (testId: string, force = false) => {
      if (!testId) return;
      if (!force && detailByTestId[testId]) return;
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/tests/${testId}`, { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as {
          test?: {
            id: string;
            module: TestModule;
            sourceConfig?: unknown;
            sections?: TestSectionDetail[];
          };
          error?: string;
          detail?: string;
        } | null;
        if (!res.ok || !data?.test) {
          throw new Error(
            data?.error || data?.detail || "Failed to load shell detail",
          );
        }
        const loadedTest = data.test;
        setDetailByTestId((prev) => ({
          ...prev,
          [testId]: {
            id: loadedTest.id,
            module: loadedTest.module,
            sourceConfig: loadedTest.sourceConfig,
            sections: Array.isArray(loadedTest.sections)
              ? loadedTest.sections
              : [],
          },
        }));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load shell detail",
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [detailByTestId],
  );

  const ensureQuestionsLoaded = useCallback(async (passageId: string) => {
    if (!passageId || questionCacheRef.current[passageId]) return;
    setLoadingPassageQuestions(passageId);
    try {
      const res = await fetch(`/api/admin/questions/by-passage/${passageId}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as {
        questions?: BankQuestion[];
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load linked questions");
      }
      const nextQuestions = Array.isArray(data?.questions)
        ? data.questions
        : [];
      setQuestionCache((prev) => {
        if (prev[passageId]) return prev;
        return {
          ...prev,
          [passageId]: nextQuestions,
        };
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load linked questions",
      );
    } finally {
      setLoadingPassageQuestions((prev) => (prev === passageId ? null : prev));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadTests(true), loadPassages()]);
    })();
  }, [loadPassages, loadTests]);

  useEffect(() => {
    if (!selectedTestId) return;
    if (detailByTestId[selectedTestId]) return;
    void loadTestDetail(selectedTestId);
  }, [detailByTestId, loadTestDetail, selectedTestId]);

  const selectedTest = useMemo(
    () => tests.find((test) => test.id === selectedTestId) || null,
    [selectedTestId, tests],
  );

  const selectedDetail = useMemo(
    () => (selectedTestId ? detailByTestId[selectedTestId] || null : null),
    [detailByTestId, selectedTestId],
  );

  useEffect(() => {
    if (!selectedTest) return;
    setEditTitle(selectedTest.title);
    setEditDescription(selectedTest.description || "");
    setEditDurationMins(selectedTest.durationMins);
    setEditVariant(selectedTest.variant);
    setEditDifficulty(selectedTest.difficulty);
    setEditIsPractice(selectedTest.isPractice);
    setPublishTitle(`${selectedTest.title} - mapped`);
    setCsvModuleFilter(
      selectedTest.module === "READING" || selectedTest.module === "LISTENING"
        ? selectedTest.module
        : "ALL",
    );

    if (!isMappingModule(selectedTest.module)) {
      setParts([]);
      return;
    }

    const sections = [...(selectedDetail?.sections || [])].sort(
      (a, b) => a.order - b.order,
    );
    const base = emptyPartsFor(selectedTest.module);
    const nextParts = base.map((row) => {
      const section = sections.find((item) => item.order === row.part);
      const selectedQuestionIds = (section?.questions || [])
        .map((question) =>
          typeof question.sourceBankItemId === "string"
            ? question.sourceBankItemId
            : "",
        )
        .filter(Boolean);
      return {
        ...row,
        passageId: section?.sourcePassageId || "",
        selectedQuestionIds,
      };
    });
    setParts(nextParts);

    const sourceConfig = asRecord(selectedDetail?.sourceConfig);
    const sourceAudioMode = sourceConfig.listeningAudioMode;
    const sourcePause = sourceConfig.listeningSectionPauseSeconds;
    const sourceMessage = sourceConfig.listeningSectionTransitionMessage;

    setListeningAudioMode(
      sourceAudioMode === "single_full_audio"
        ? "single_full_audio"
        : "sequential_section_audio",
    );
    setListeningSectionPauseSeconds(
      Number.isFinite(Number(sourcePause))
        ? Math.max(0, Math.min(120, Math.round(Number(sourcePause))))
        : 10,
    );
    setListeningSectionTransitionMessage(
      typeof sourceMessage === "string" && sourceMessage.trim()
        ? sourceMessage.trim()
        : DEFAULT_SECTION_TRANSITION_MESSAGE,
    );

    const firstPassageId =
      nextParts.find((row) => row.passageId)?.passageId || "";
    setDefaultPassageId(firstPassageId);

    void Promise.all(
      nextParts
        .filter((row) => row.passageId)
        .map((row) => ensureQuestionsLoaded(row.passageId)),
    );
  }, [ensureQuestionsLoaded, selectedDetail, selectedTest, selectedTestId]);

  async function createShell(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = (await res.json().catch(() => null)) as {
        test?: TestRow;
        error?: string;
        detail?: string;
      } | null;
      if (!res.ok || !data?.test) {
        throw new Error(
          data?.error || data?.detail || "Failed to create shell",
        );
      }
      const created = data.test;
      setTests((prev) => [created, ...prev]);
      setSelectedTestId(created.id);
      setNewShellId(created.id);
      setCreateForm(EMPTY_CREATE);
      setStep(2);
      setNotice(
        "Shell created. Continue in Step 2 to map passages, media, and questions.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shell creation failed");
    } finally {
      setCreating(false);
    }
  }

  async function saveSelectedShell() {
    if (!selectedTest) return;
    setSavingShell(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/tests/${selectedTest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription,
          durationMins: editDurationMins,
          variant: editVariant,
          difficulty: editDifficulty,
          isPractice: editIsPractice,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        test?: TestRow;
        error?: string;
        detail?: string;
      } | null;
      if (!res.ok || !data?.test) {
        throw new Error(
          data?.error || data?.detail || "Failed to update shell",
        );
      }
      setTests((prev) =>
        prev.map((test) =>
          test.id === data.test!.id ? { ...test, ...data.test! } : test,
        ),
      );
      setNotice("Shell metadata updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shell update failed");
    } finally {
      setSavingShell(false);
    }
  }

  async function toggleShellActive(test: TestRow) {
    setBusyTestId(test.id);
    setError(null);
    setNotice(null);
    const nextActive = !test.isActive;
    setTests((prev) =>
      prev.map((row) =>
        row.id === test.id ? { ...row, isActive: nextActive } : row,
      ),
    );
    try {
      const res = await fetch(`/api/admin/tests/${test.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (!res.ok) throw new Error("Failed to update shell status");
      setNotice(nextActive ? "Shell moved to active." : "Shell archived.");
    } catch (err) {
      setTests((prev) =>
        prev.map((row) =>
          row.id === test.id ? { ...row, isActive: test.isActive } : row,
        ),
      );
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusyTestId(null);
    }
  }

  const filteredTests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tests.filter((test) => {
      if (moduleFilter !== "ALL" && test.module !== moduleFilter) return false;
      if (statusFilter !== "ALL" && inferTestStatus(test) !== statusFilter)
        return false;
      if (!needle) return true;
      return (
        test.title.toLowerCase().includes(needle) ||
        (test.description || "").toLowerCase().includes(needle)
      );
    });
  }, [moduleFilter, query, statusFilter, tests]);

  const coverage = useMemo(() => {
    const total = tests.length;
    const live = tests.filter(
      (test) => inferTestStatus(test) === "LIVE",
    ).length;
    const archived = tests.filter(
      (test) => inferTestStatus(test) === "ARCHIVED",
    ).length;
    const incomplete = tests.filter((test) => {
      if (test.module === "WRITING") return test.totalQuestions < 2;
      if (test.module === "SPEAKING") return test.totalQuestions < 3;
      return test.totalQuestions < 40;
    }).length;
    return { total, live, archived, incomplete };
  }, [tests]);

  const passageById = useMemo(
    () => new Map(passages.map((passage) => [passage.id, passage])),
    [passages],
  );

  const mappingPassages = useMemo(() => {
    if (!selectedTest || !isMappingModule(selectedTest.module)) return [];
    return passages.filter((passage) => passage.module === selectedTest.module);
  }, [passages, selectedTest]);

  async function onSelectPassage(part: number, passageId: string) {
    setError(null);
    setNotice(null);
    try {
      if (passageId) await ensureQuestionsLoaded(passageId);
      setParts((prev) =>
        prev.map((row) =>
          row.part === part
            ? { ...row, passageId, selectedQuestionIds: [] }
            : row,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load linked questions",
      );
    }
  }

  function toggleQuestion(part: number, questionId: string) {
    if (!selectedTest || !isMappingModule(selectedTest.module)) return;
    const limit = questionLimitPerPart(selectedTest.module);
    setParts((prev) =>
      prev.map((row) => {
        if (row.part !== part) return row;
        const exists = row.selectedQuestionIds.includes(questionId);
        if (exists) {
          return {
            ...row,
            selectedQuestionIds: row.selectedQuestionIds.filter(
              (id) => id !== questionId,
            ),
          };
        }
        if (row.selectedQuestionIds.length >= limit) return row;
        return {
          ...row,
          selectedQuestionIds: [...row.selectedQuestionIds, questionId],
        };
      }),
    );
  }

  function moveQuestion(part: number, index: number, direction: -1 | 1) {
    setParts((prev) =>
      prev.map((row) => {
        if (row.part !== part) return row;
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= row.selectedQuestionIds.length)
          return row;
        const next = [...row.selectedQuestionIds];
        const current = next[index];
        next[index] = next[nextIndex];
        next[nextIndex] = current;
        return { ...row, selectedQuestionIds: next };
      }),
    );
  }

  function autoFillPart(part: number) {
    if (!selectedTest || !isMappingModule(selectedTest.module)) return;
    const limit = questionLimitPerPart(selectedTest.module);
    setParts((prev) =>
      prev.map((row) => {
        if (row.part !== part || !row.passageId) return row;
        const linked = questionCache[row.passageId] || [];
        const nextIds = linked.slice(0, limit).map((question) => question.id);
        return { ...row, selectedQuestionIds: nextIds };
      }),
    );
  }

  const mappingCompleteness = useMemo(() => {
    if (!selectedTest || !isMappingModule(selectedTest.module)) return null;
    const expectedSections = selectedTest.module === "READING" ? 3 : 4;
    const expectedQuestions = 40;
    const sectionCount = parts.filter((row) => row.passageId).length;
    const questionCount = parts.reduce(
      (sum, row) => sum + row.selectedQuestionIds.length,
      0,
    );
    const missingPassage = parts.filter((row) => !row.passageId).length;
    const missingAudio =
      selectedTest.module === "LISTENING"
        ? parts.filter((row) => {
            if (!row.passageId) return false;
            const passage = passageById.get(row.passageId);
            return !passage?.media.some((media) => media.type === "AUDIO");
          }).length
        : 0;
    const incompleteSections =
      selectedTest.module === "READING"
        ? parts.filter((row) => {
            const count = row.selectedQuestionIds.length;
            return count < 13 || count > 14;
          }).length
        : parts.filter((row) => row.selectedQuestionIds.length !== 10).length;

    const pass =
      sectionCount === expectedSections &&
      questionCount === expectedQuestions &&
      missingPassage === 0 &&
      incompleteSections === 0;

    return {
      pass,
      expectedSections,
      expectedQuestions,
      sectionCount,
      questionCount,
      missingPassage,
      missingAudio,
      incompleteSections,
    };
  }, [parts, passageById, selectedTest]);

  async function publishMappedTest() {
    if (!selectedTest || !isMappingModule(selectedTest.module)) {
      setError(
        "Mapping publish is only available for Reading/Listening shells.",
      );
      return;
    }
    if (!mappingCompleteness?.pass) {
      setError(
        "Mapping incomplete. Fill all sections and question counts first.",
      );
      return;
    }
    const finalTitle = publishTitle.trim();
    if (!finalTitle) {
      setError("Publish title is required.");
      return;
    }

    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        title: finalTitle,
        description: editDescription,
        module: selectedTest.module,
        variant: editVariant,
        difficulty: editDifficulty,
        kind: editIsPractice ? "PRACTICE" : "MOCK",
        durationMins: editDurationMins,
        sections: parts.map((row) => ({
          part: row.part,
          passageId: row.passageId,
          questionIds: row.selectedQuestionIds,
        })),
        listeningAudioMode:
          selectedTest.module === "LISTENING" ? listeningAudioMode : undefined,
        listeningSectionPauseSeconds:
          selectedTest.module === "LISTENING"
            ? listeningSectionPauseSeconds
            : undefined,
        listeningSectionTransitionMessage:
          selectedTest.module === "LISTENING"
            ? listeningSectionTransitionMessage
            : undefined,
      };

      const res = await fetch("/api/admin/question-map/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as {
        testId?: string;
        error?: string;
        detail?: string;
      } | null;
      if (!res.ok || !data?.testId) {
        throw new Error(
          data?.error || data?.detail || "Failed to publish mapped test",
        );
      }

      if (archiveShellAfterPublish) {
        await fetch(`/api/admin/tests/${selectedTest.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        }).catch(() => undefined);
      }

      await loadTests(false);
      await loadTestDetail(data.testId, true);
      setSelectedTestId(data.testId);
      setStep(3);
      setNotice(
        `Mapped test published (ID: ${data.testId}). ${
          archiveShellAfterPublish
            ? "Previous shell archived."
            : "Previous shell kept active."
        }`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  function downloadCsvTemplate() {
    const csv = `${CSV_TEMPLATE_HEADERS.join(",")}\n${CSV_TEMPLATE_SAMPLE.join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "test_studio_shell_csv_template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function onCsvFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void (async () => {
      setError(null);
      setNotice(null);
      try {
        const text = await file.text();
        const parsedRows = parseCsvRows(text);
        if (!parsedRows.length) throw new Error("CSV is empty");

        const headers = parsedRows[0].map((header) =>
          header.trim().toLowerCase(),
        );
        const missingRequired = REQUIRED_CSV_HEADERS.filter(
          (header) => !headers.includes(header),
        );
        if (missingRequired.length) {
          throw new Error(
            `CSV missing required columns: ${missingRequired.join(", ")}`,
          );
        }

        const objects = rowsToObjects(parsedRows).map(normalizeCsvRow);
        if (!headers.includes("passage_id")) headers.push("passage_id");
        if (!headers.includes("module")) headers.push("module");
        if (!headers.includes("section_part")) headers.push("section_part");
        if (!headers.includes("difficulty")) headers.push("difficulty");
        if (!headers.includes("question_audio_url"))
          headers.push("question_audio_url");

        setCsvHeaders(headers);
        setCsvRows(objects);
        setNotice(
          `Loaded ${objects.length} CSV rows for shell workflow preview/edit.`,
        );
      } catch (err) {
        setCsvHeaders([]);
        setCsvRows([]);
        setError(err instanceof Error ? err.message : "CSV parse failed");
      }
    })();
  }

  function updateCsvCell(rowIndex: number, key: string, value: string) {
    setCsvRows((prev) =>
      prev.map((row, idx) =>
        idx === rowIndex ? { ...row, [key]: value } : row,
      ),
    );
  }

  function duplicateCsvRow(rowIndex: number) {
    setCsvRows((prev) => {
      const row = prev[rowIndex];
      if (!row) return prev;
      const next = [...prev];
      next.splice(rowIndex + 1, 0, { ...row });
      return next;
    });
  }

  function deleteCsvRow(rowIndex: number) {
    setCsvRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
  }

  function addCsvRow() {
    const base: CsvDraftRow = {};
    csvHeaders.forEach((header) => {
      base[header] = "";
    });
    setCsvRows((prev) => [...prev, base]);
  }

  const draftWithSuggestions = useMemo(
    () =>
      csvRows.map((row) => {
        const hint = passageHint(row, passages);
        return {
          row,
          ...hint,
        };
      }),
    [csvRows, passages],
  );

  const validations = useMemo(
    () => validateCsvRows(csvRows, passages),
    [csvRows, passages],
  );

  const validationSummary = useMemo(() => {
    const invalidRows = validations.filter((item) => !item.isValid).length;
    const warningRows = validations.filter(
      (item) => item.warnings.length > 0,
    ).length;
    return { invalidRows, warningRows };
  }, [validations]);

  const filteredDraft = useMemo(() => {
    return draftWithSuggestions
      .map((entry, index) => ({
        ...entry,
        index,
        validation: validations[index],
      }))
      .filter((entry) => {
        const row = entry.row;
        const needle = csvSearch.trim().toLowerCase();
        if (needle) {
          const joined = Object.values(row).join(" ").toLowerCase();
          if (!joined.includes(needle)) return false;
        }
        if (csvModuleFilter !== "ALL") {
          const moduleName = (row.module || "").trim().toUpperCase();
          if (moduleName !== csvModuleFilter) return false;
        }
        if (csvSectionFilter !== "ALL") {
          if ((row.section_part || "").trim() !== csvSectionFilter)
            return false;
        }
        if (csvDifficultyFilter !== "ALL") {
          const difficulty = (row.difficulty || "").trim().toUpperCase();
          if (difficulty !== csvDifficultyFilter) return false;
        }
        return true;
      });
  }, [
    csvDifficultyFilter,
    csvModuleFilter,
    csvSearch,
    csvSectionFilter,
    draftWithSuggestions,
    validations,
  ]);

  function applyPassageSuggestion(index: number) {
    const hint = draftWithSuggestions[index];
    if (!hint?.suggestedPassageId) return;
    updateCsvCell(index, "passage_id", hint.suggestedPassageId);
  }

  function applyDefaultPassageToMissingRows() {
    if (!defaultPassageId) return;
    setCsvRows((prev) =>
      prev.map((row) =>
        (row.passage_id || "").trim()
          ? row
          : {
              ...row,
              passage_id: defaultPassageId,
            },
      ),
    );
    setNotice("Applied default passage_id to rows missing passage link.");
  }

  async function uploadCsvDraft() {
    if (!selectedTest) {
      setError("Select a shell first.");
      return;
    }
    if (!csvRows.length) {
      setError("No CSV draft rows to upload.");
      return;
    }
    if (validationSummary.invalidRows > 0 && !allowInvalidOverride) {
      setError(
        `Fix ${validationSummary.invalidRows} invalid row(s), or enable override.`,
      );
      return;
    }

    setUploadingCsv(true);
    setError(null);
    setNotice(null);
    try {
      const csvText = csvFromRows(csvHeaders, csvRows);
      const res = await fetch("/api/admin/question-bank/upload-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, defaultPassageId }),
      });
      const data = (await res.json().catch(() => null)) as {
        inserted?: number;
        warnings?: string[];
        issues?: string[];
        error?: string;
        detail?: string;
      } | null;
      if (!res.ok) {
        const issues = Array.isArray(data?.issues)
          ? data.issues.join("\n")
          : "";
        const detail = typeof data?.detail === "string" ? data.detail : "";
        throw new Error(
          [data?.error || "Upload failed", issues, detail]
            .filter(Boolean)
            .join("\n"),
        );
      }

      setNotice(
        `CSV draft uploaded for "${selectedTest.title}" workflow. Inserted ${
          data?.inserted || 0
        } bank rows.`,
      );
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        setNotice(
          `Uploaded with warnings:\n${data.warnings.slice(0, 8).join("\n")}`,
        );
      }
      setCsvRows([]);
      setCsvHeaders([]);
      setAllowInvalidOverride(false);

      setQuestionCache((prev) => {
        const next = { ...prev };
        for (const row of parts) {
          if (row.passageId) delete next[row.passageId];
        }
        return next;
      });
      await Promise.all(
        parts
          .filter((row) => row.passageId)
          .map((row) => ensureQuestionsLoaded(row.passageId)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV upload failed");
    } finally {
      setUploadingCsv(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-brand-purple via-brand-purple-dark to-brand-teal p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Test Studio</h1>
        <p className="mt-2 text-sm text-white/85">
          Shell-first workflow: create shell - select shell - map
          passages/questions - inspect - publish.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Total shells" value={String(coverage.total)} />
        <MetricCard label="Live tests" value={String(coverage.live)} />
        <MetricCard label="Archived" value={String(coverage.archived)} />
        <MetricCard label="Incomplete" value={String(coverage.incomplete)} />
      </section>

      {error ? (
        <div className="whitespace-pre-line rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="whitespace-pre-line rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3">
          {(
            [
              {
                id: 1,
                label: "Step 1",
                title: "Create Test Shell",
                subtitle: "Module, variant, difficulty",
              },
              {
                id: 2,
                label: "Step 2",
                title: "Select + Map Shell",
                subtitle: "Passage, media, linked questions, shell CSV",
              },
              {
                id: 3,
                label: "Step 3",
                title: "Inspector + Publish",
                subtitle: "Full mapped review before publish",
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={[
                "rounded-xl border p-3 text-left transition",
                step === item.id
                  ? "border-brand-purple bg-brand-purple/5"
                  : "border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {item.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
            </button>
          ))}
        </div>
      </section>

      {step === 1 ? (
        <section className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Step 1 - Create Test Shell
          </h2>
          <form
            onSubmit={createShell}
            className="mt-3 grid gap-3 md:grid-cols-3"
          >
            <input
              value={createForm.title}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Test title"
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={createForm.module}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  module: e.target.value as TestModule,
                  durationMins: e.target.value === "LISTENING" ? 30 : 60,
                }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="READING">READING</option>
              <option value="LISTENING">LISTENING</option>
              <option value="WRITING">WRITING</option>
              <option value="SPEAKING">SPEAKING</option>
            </select>
            <select
              value={createForm.variant}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  variant: e.target.value as VariantInput,
                }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ACADEMIC">ACADEMIC</option>
              <option value="GENERAL">GENERAL</option>
            </select>
            <select
              value={createForm.difficulty}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  difficulty: e.target.value as DifficultyInput,
                }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="EASY">EASY</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HARD">HARD</option>
            </select>
            <input
              type="number"
              min={5}
              max={240}
              value={createForm.durationMins}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  durationMins: Math.max(5, Number(e.target.value) || 60),
                }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={String(createForm.isPractice)}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  isPractice: e.target.value === "true",
                }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="true">Practice</option>
              <option value="false">Simulation</option>
            </select>
            <textarea
              value={createForm.description}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={2}
              placeholder="Description (optional)"
              className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create Shell & Go Step 2"}
            </button>
          </form>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-4 xl:grid-cols-[1.05fr_1.95fr]">
          <article className="space-y-3 rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Step 2A - Shell Browser
            </h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shells..."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={moduleFilter}
                onChange={(e) =>
                  setModuleFilter(e.target.value as "ALL" | TestModule)
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">All modules</option>
                <option value="READING">READING</option>
                <option value="LISTENING">LISTENING</option>
                <option value="WRITING">WRITING</option>
                <option value="SPEAKING">SPEAKING</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "ALL" | StatusChip)
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="READY">Ready</option>
                <option value="LIVE">Live</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => void loadTests(false)}
              disabled={refreshing}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh shells"}
            </button>

            {loading ? (
              <div className="h-44 animate-pulse rounded-xl bg-slate-100" />
            ) : filteredTests.length ? (
              <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                {filteredTests.map((test) => {
                  const status = inferTestStatus(test);
                  const selected = selectedTestId === test.id;
                  return (
                    <article
                      key={test.id}
                      className={[
                        "rounded-xl border p-3",
                        selected
                          ? "border-brand-purple bg-brand-purple/5"
                          : "border-slate-200",
                        newShellId === test.id ? "ring-2 ring-emerald-300" : "",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTestId(test.id);
                          setStep(2);
                        }}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">
                            {test.title}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_CLS[status]}`}
                          >
                            {status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {test.module} - {test.variant} - {test.difficulty} -{" "}
                          {test.durationMins} mins
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Questions: {test.totalQuestions}
                          {typeof test.attemptsCount === "number"
                            ? ` - Attempts: ${test.attemptsCount}`
                            : ""}
                        </p>
                      </button>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => void toggleShellActive(test)}
                          disabled={busyTestId === test.id}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          {test.isActive ? "Archive" : "Set Active"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTestId(test.id);
                            setStep(3);
                          }}
                          className="rounded-lg border border-brand-purple/40 bg-brand-purple/5 px-2 py-1 text-xs font-semibold text-brand-purple"
                        >
                          Open Inspector
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No shells found.</p>
            )}
          </article>

          <article className="space-y-4 rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Step 2B - Mapping Workspace
              </h2>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/admin/question-map"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Legacy map builder
                </Link>
                <Link
                  href="/dashboard/admin/resources"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Legacy shell manager
                </Link>
              </div>
            </div>

            {!selectedTest ? (
              <p className="text-sm text-slate-500">
                Select a shell from the left to start mapping.
              </p>
            ) : !isMappingModule(selectedTest.module) ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {selectedTest.module} shell selected. In this studio, integrated
                passage/question mapping is available for Reading and Listening
                shells. You can still edit shell metadata from the Step 3
                inspector.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Active Shell
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {selectedTest.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedTest.module} - {selectedTest.variant} -{" "}
                    {selectedTest.difficulty}
                    {" - "}
                    {selectedTest.durationMins} mins
                  </p>
                </div>

                <div className="space-y-4">
                  {parts.map((partState) => {
                    const selectedPassage = partState.passageId
                      ? passageById.get(partState.passageId) || null
                      : null;
                    const linkedQuestions = partState.passageId
                      ? questionCache[partState.passageId] || []
                      : [];
                    const limit = selectedTest.module === "READING" ? 14 : 10;
                    const count = partState.selectedQuestionIds.length;
                    const selectedLookup = new Map(
                      linkedQuestions.map((question) => [
                        question.id,
                        question,
                      ]),
                    );
                    const otherSelected = new Set(
                      parts
                        .filter((row) => row.part !== partState.part)
                        .map((row) => row.passageId)
                        .filter(Boolean),
                    );

                    return (
                      <article
                        key={partState.part}
                        className="rounded-xl border border-slate-200 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold text-slate-900">
                            {selectedTest.module === "READING"
                              ? `Passage ${partState.part}`
                              : `Section ${partState.part}`}
                          </h3>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-500">
                              Selected: {count}/{limit}
                            </p>
                            <button
                              type="button"
                              onClick={() => autoFillPart(partState.part)}
                              disabled={!partState.passageId}
                              className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
                            >
                              Auto-fill
                            </button>
                          </div>
                        </div>

                        <div className="mt-2">
                          <select
                            value={partState.passageId}
                            onChange={(e) =>
                              void onSelectPassage(
                                partState.part,
                                e.target.value,
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="">
                              Select passage/content source
                            </option>
                            {mappingPassages
                              .filter(
                                (passage) =>
                                  passage.id === partState.passageId ||
                                  !otherSelected.has(passage.id),
                              )
                              .map((passage) => (
                                <option key={passage.id} value={passage.id}>
                                  {passage.title} (Part {passage.sectionPart})
                                </option>
                              ))}
                          </select>
                        </div>

                        {selectedPassage ? (
                          <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                            <p>
                              {selectedPassage.content
                                ? `${selectedPassage.content.slice(0, 180)}...`
                                : "No passage text (media-only source)."}
                            </p>
                            <p className="mt-1">
                              Media:{" "}
                              {selectedPassage.media.length
                                ? selectedPassage.media
                                    .map((media) =>
                                      media.label
                                        ? `${media.type}:${media.label}`
                                        : media.type,
                                    )
                                    .join(", ")
                                : "None"}
                            </p>
                          </div>
                        ) : null}

                        {partState.passageId &&
                        loadingPassageQuestions === partState.passageId ? (
                          <p className="mt-3 text-xs text-slate-500">
                            Loading linked questions...
                          </p>
                        ) : null}

                        {linkedQuestions.length ? (
                          <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
                            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                              {linkedQuestions.map((question) => {
                                const checked =
                                  partState.selectedQuestionIds.includes(
                                    question.id,
                                  );
                                const disableNew = !checked && count >= limit;
                                return (
                                  <label
                                    key={question.id}
                                    className="block rounded-lg border border-slate-100 p-2 text-sm"
                                  >
                                    <div className="flex items-start gap-2">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={disableNew}
                                        onChange={() =>
                                          toggleQuestion(
                                            partState.part,
                                            question.id,
                                          )
                                        }
                                        className="mt-1"
                                      />
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">
                                          {question.type}
                                        </p>
                                        <p className="text-slate-700">
                                          {question.questionText}
                                        </p>
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>

                            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Selected Order
                              </p>
                              {partState.selectedQuestionIds.length ? (
                                partState.selectedQuestionIds.map(
                                  (questionId, index) => {
                                    const question =
                                      selectedLookup.get(questionId);
                                    return (
                                      <div
                                        key={`${questionId}-${index}`}
                                        className="rounded-lg border border-slate-100 p-2"
                                      >
                                        <p className="text-[11px] font-semibold text-slate-500">
                                          Q{index + 1}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-700">
                                          {question?.questionText || questionId}
                                        </p>
                                        <div className="mt-2 flex gap-1">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              moveQuestion(
                                                partState.part,
                                                index,
                                                -1,
                                              )
                                            }
                                            disabled={index === 0}
                                            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] disabled:opacity-40"
                                          >
                                            Up
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              moveQuestion(
                                                partState.part,
                                                index,
                                                1,
                                              )
                                            }
                                            disabled={
                                              index ===
                                              partState.selectedQuestionIds
                                                .length -
                                                1
                                            }
                                            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] disabled:opacity-40"
                                          >
                                            Down
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  },
                                )
                              ) : (
                                <p className="text-xs text-slate-500">
                                  No questions selected yet.
                                </p>
                              )}
                            </div>
                          </div>
                        ) : partState.passageId ? (
                          <p className="mt-3 text-sm text-slate-500">
                            No linked bank questions found for this passage.
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>

                <section className="rounded-xl border border-brand-purple/15 bg-slate-50/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Shell CSV Draft Editor
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs">
                        <input
                          type="checkbox"
                          checked={allowInvalidOverride}
                          onChange={(e) =>
                            setAllowInvalidOverride(e.target.checked)
                          }
                        />
                        Allow override
                      </label>
                      <button
                        type="button"
                        onClick={addCsvRow}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        Add row
                      </button>
                      <button
                        type="button"
                        onClick={uploadCsvDraft}
                        disabled={uploadingCsv || !csvRows.length}
                        className="rounded-lg bg-brand-teal px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {uploadingCsv ? "Uploading..." : "Confirm & Upload"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadCsvTemplate}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                    >
                      Download template
                    </button>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={onCsvFileChange}
                    />
                    <FieldInline label="Default passage_id">
                      <select
                        value={defaultPassageId}
                        onChange={(e) => setDefaultPassageId(e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="">No default</option>
                        {mappingPassages.map((passage) => (
                          <option key={passage.id} value={passage.id}>
                            {passage.title}
                          </option>
                        ))}
                      </select>
                    </FieldInline>
                    <button
                      type="button"
                      onClick={applyDefaultPassageToMissingRows}
                      disabled={!defaultPassageId || !csvRows.length}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      Apply default passage_id
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <input
                      value={csvSearch}
                      onChange={(e) => setCsvSearch(e.target.value)}
                      placeholder="Search rows..."
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    />
                    <select
                      value={csvModuleFilter}
                      onChange={(e) => setCsvModuleFilter(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="ALL">All modules</option>
                      <option value="READING">READING</option>
                      <option value="LISTENING">LISTENING</option>
                      <option value="WRITING">WRITING</option>
                    </select>
                    <select
                      value={csvSectionFilter}
                      onChange={(e) => setCsvSectionFilter(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="ALL">All sections</option>
                      {Array.from({ length: 10 }).map((_, idx) => (
                        <option key={idx + 1} value={String(idx + 1)}>
                          Part {idx + 1}
                        </option>
                      ))}
                    </select>
                    <select
                      value={csvDifficultyFilter}
                      onChange={(e) => setCsvDifficultyFilter(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="ALL">All difficulties</option>
                      <option value="EASY">EASY</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HARD">HARD</option>
                    </select>
                  </div>

                  <p className="mt-3 text-xs text-slate-600">
                    Invalid rows: {validationSummary.invalidRows} - Warning
                    rows: {validationSummary.warningRows}
                  </p>

                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="max-h-[58vh] overflow-auto">
                      {filteredDraft.length ? (
                        <table className="w-max min-w-[1180px] divide-y divide-slate-200 text-xs">
                          <thead className="sticky top-0 bg-slate-50">
                            <tr>
                              <th className="px-2 py-2 text-left">#</th>
                              <th className="px-2 py-2 text-left">Actions</th>
                              {csvHeaders.map((header) => (
                                <th
                                  key={header}
                                  className="px-2 py-2 text-left uppercase"
                                >
                                  {header}
                                </th>
                              ))}
                              <th className="px-2 py-2 text-left">
                                Validation
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredDraft.map((entry) => {
                              const linkedPassage = entry.row.passage_id
                                ? passageById.get(entry.row.passage_id) || null
                                : null;
                              return (
                                <tr
                                  key={entry.index}
                                  className={
                                    entry.validation.issues.length
                                      ? "bg-rose-50/70"
                                      : entry.validation.warnings.length
                                        ? "bg-amber-50/60"
                                        : ""
                                  }
                                >
                                  <td className="px-2 py-2 align-top">
                                    {entry.index + 1}
                                  </td>
                                  <td className="px-2 py-2 align-top">
                                    <div className="flex flex-col gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          duplicateCsvRow(entry.index)
                                        }
                                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px]"
                                      >
                                        Duplicate
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteCsvRow(entry.index)
                                        }
                                        className="rounded border border-rose-300 px-1.5 py-0.5 text-[10px] text-rose-700"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                  {csvHeaders.map((header) => (
                                    <td
                                      key={`${entry.index}-${header}`}
                                      className="px-2 py-2 align-top"
                                    >
                                      {header === "passage_id" ? (
                                        <div className="space-y-1">
                                          <input
                                            value={entry.row[header] || ""}
                                            onChange={(e) =>
                                              updateCsvCell(
                                                entry.index,
                                                header,
                                                e.target.value,
                                              )
                                            }
                                            placeholder="manual passage_id"
                                            className="w-[220px] rounded border border-slate-300 px-1.5 py-1 text-[11px]"
                                          />
                                          <select
                                            value={entry.row[header] || ""}
                                            onChange={(e) =>
                                              updateCsvCell(
                                                entry.index,
                                                header,
                                                e.target.value,
                                              )
                                            }
                                            className="w-[220px] rounded border border-slate-300 px-1.5 py-1 text-[11px]"
                                          >
                                            <option value="">
                                              Select passage
                                            </option>
                                            {mappingPassages.map((passage) => (
                                              <option
                                                key={passage.id}
                                                value={passage.id}
                                              >
                                                {passage.title} (
                                                {passage.module}{" "}
                                                {passage.sectionPart})
                                              </option>
                                            ))}
                                          </select>
                                          {entry.suggestedPassageId ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                applyPassageSuggestion(
                                                  entry.index,
                                                )
                                              }
                                              className="rounded border border-brand-purple/30 bg-brand-purple/5 px-1.5 py-0.5 text-[10px] text-brand-purple"
                                            >
                                              Use suggestion
                                            </button>
                                          ) : null}
                                          {linkedPassage ? (
                                            <p className="text-[10px] text-slate-500">
                                              Media:{" "}
                                              {linkedPassage.media.length
                                                ? linkedPassage.media
                                                    .map((media) => media.type)
                                                    .join(", ")
                                                : "none"}
                                            </p>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <input
                                          value={entry.row[header] || ""}
                                          onChange={(e) =>
                                            updateCsvCell(
                                              entry.index,
                                              header,
                                              e.target.value,
                                            )
                                          }
                                          className="w-[180px] rounded border border-slate-300 px-1.5 py-1 text-[11px]"
                                        />
                                      )}
                                    </td>
                                  ))}
                                  <td className="px-2 py-2 align-top">
                                    {entry.validation.issues.length ? (
                                      <p className="text-[11px] text-rose-700">
                                        {entry.validation.issues.join(", ")}
                                      </p>
                                    ) : null}
                                    {entry.validation.warnings.length ? (
                                      <p className="text-[11px] text-amber-700">
                                        {entry.validation.warnings.join(", ")}
                                      </p>
                                    ) : null}
                                    {entry.reason ? (
                                      <p className="text-[10px] text-slate-500">
                                        {entry.reason}
                                      </p>
                                    ) : null}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-4 text-sm text-slate-500">
                          Upload CSV and edit rows here for this selected shell
                          before final upload.
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Back to Step 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white"
                  >
                    Continue to Step 3 Inspector
                  </button>
                </div>
              </>
            )}
          </article>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
          <article className="space-y-4 rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Step 3 - Review & Publish
            </h2>

            {selectedTest ? (
              <>
                <div className="rounded-xl border border-slate-200 p-3 text-sm">
                  <p>
                    <span className="font-semibold">Shell:</span>{" "}
                    {selectedTest.title}
                  </p>
                  <p>
                    <span className="font-semibold">Module:</span>{" "}
                    {selectedTest.module}
                  </p>
                  <p>
                    <span className="font-semibold">Variant:</span>{" "}
                    {editVariant}
                  </p>
                  <p>
                    <span className="font-semibold">Difficulty:</span>{" "}
                    {editDifficulty}
                  </p>
                  <p>
                    <span className="font-semibold">Duration:</span>{" "}
                    {editDurationMins} mins
                  </p>
                </div>

                {isMappingModule(selectedTest.module) && mappingCompleteness ? (
                  <>
                    <div className="space-y-2">
                      {[
                        {
                          label: `Sections mapped ${mappingCompleteness.sectionCount}/${mappingCompleteness.expectedSections}`,
                          ok:
                            mappingCompleteness.sectionCount ===
                            mappingCompleteness.expectedSections,
                          warning: false,
                        },
                        {
                          label: `Questions mapped ${mappingCompleteness.questionCount}/${mappingCompleteness.expectedQuestions}`,
                          ok:
                            mappingCompleteness.questionCount ===
                            mappingCompleteness.expectedQuestions,
                          warning: false,
                        },
                        {
                          label: `Missing passages ${mappingCompleteness.missingPassage}`,
                          ok: mappingCompleteness.missingPassage === 0,
                          warning: false,
                        },
                        {
                          label: `Incomplete sections ${mappingCompleteness.incompleteSections}`,
                          ok: mappingCompleteness.incompleteSections === 0,
                          warning: false,
                        },
                        {
                          label: `Listening sections without audio ${mappingCompleteness.missingAudio}`,
                          ok: mappingCompleteness.missingAudio === 0,
                          warning: true,
                        },
                      ].map((line) => (
                        <p
                          key={line.label}
                          className={[
                            "rounded-lg px-3 py-2 text-sm",
                            line.ok
                              ? "bg-emerald-100 text-emerald-700"
                              : line.warning
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-700",
                          ].join(" ")}
                        >
                          {line.ok ? "OK" : "-"} {line.label}
                        </p>
                      ))}
                    </div>

                    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Mapped Breakdown
                      </p>
                      {parts.map((row) => {
                        const passage = row.passageId
                          ? passageById.get(row.passageId) || null
                          : null;
                        const hasAudio = Boolean(
                          passage?.media.some(
                            (media) => media.type === "AUDIO",
                          ),
                        );
                        return (
                          <div
                            key={row.part}
                            className="rounded-lg border border-slate-100 p-2 text-xs text-slate-700"
                          >
                            <p className="font-semibold">
                              {selectedTest.module === "READING"
                                ? `Passage ${row.part}`
                                : `Section ${row.part}`}
                            </p>
                            <p className="mt-1">
                              Source: {passage?.title || "Not selected"} -
                              Questions: {row.selectedQuestionIds.length}
                            </p>
                            {selectedTest.module === "LISTENING" ? (
                              <p className="mt-1">
                                Audio available: {hasAudio ? "Yes" : "No"}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Publish Settings
                      </p>
                      <Field label="Published test title">
                        <input
                          value={publishTitle}
                          onChange={(e) => setPublishTitle(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Mapped test title"
                        />
                      </Field>

                      {selectedTest.module === "LISTENING" ? (
                        <div className="grid gap-2 md:grid-cols-3">
                          <Field label="Audio structure">
                            <select
                              value={listeningAudioMode}
                              onChange={(e) =>
                                setListeningAudioMode(
                                  e.target.value as ListeningAudioMode,
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                              <option value="sequential_section_audio">
                                Sequential section audio
                              </option>
                              <option value="single_full_audio">
                                Single full-test audio
                              </option>
                            </select>
                          </Field>
                          <Field label="Section pause (sec)">
                            <input
                              type="number"
                              min={0}
                              max={120}
                              value={listeningSectionPauseSeconds}
                              onChange={(e) =>
                                setListeningSectionPauseSeconds(
                                  Math.max(
                                    0,
                                    Math.min(120, Number(e.target.value) || 0),
                                  ),
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                          </Field>
                          <Field label="Transition message">
                            <input
                              value={listeningSectionTransitionMessage}
                              onChange={(e) =>
                                setListeningSectionTransitionMessage(
                                  e.target.value,
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                          </Field>
                        </div>
                      ) : null}

                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={archiveShellAfterPublish}
                          onChange={(e) =>
                            setArchiveShellAfterPublish(e.target.checked)
                          }
                        />
                        Archive current shell after publish
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Back to Step 2
                        </button>
                        <button
                          type="button"
                          onClick={() => void publishMappedTest()}
                          disabled={publishing || !mappingCompleteness.pass}
                          className="rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {publishing ? "Publishing..." : "Publish mapped test"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    This shell module does not require passage/question mapping
                    publish here.
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Select a shell in Step 2 to inspect and publish.
              </p>
            )}
          </article>

          <aside className="h-fit space-y-3 rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm xl:sticky xl:top-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Inspector Panel
            </h2>
            {selectedTest ? (
              <>
                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shell Metadata
                  </p>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={editVariant}
                      onChange={(e) =>
                        setEditVariant(e.target.value as VariantInput)
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    >
                      <option value="ACADEMIC">ACADEMIC</option>
                      <option value="GENERAL">GENERAL</option>
                    </select>
                    <select
                      value={editDifficulty}
                      onChange={(e) =>
                        setEditDifficulty(e.target.value as DifficultyInput)
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    >
                      <option value="EASY">EASY</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HARD">HARD</option>
                    </select>
                    <input
                      type="number"
                      min={5}
                      max={240}
                      value={editDurationMins}
                      onChange={(e) =>
                        setEditDurationMins(
                          Math.max(5, Number(e.target.value) || 60),
                        )
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    <select
                      value={String(editIsPractice)}
                      onChange={(e) =>
                        setEditIsPractice(e.target.value === "true")
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    >
                      <option value="true">Practice</option>
                      <option value="false">Simulation</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveSelectedShell()}
                    disabled={savingShell}
                    className="w-full rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {savingShell ? "Saving..." : "Save shell metadata"}
                  </button>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Completeness Snapshot
                  </p>
                  {detailLoading && !selectedDetail ? (
                    <p className="text-xs text-slate-500">
                      Loading shell detail...
                    </p>
                  ) : mappingCompleteness ? (
                    <ul className="space-y-1 text-xs text-slate-700">
                      <li>
                        Sections: {mappingCompleteness.sectionCount}/
                        {mappingCompleteness.expectedSections}
                      </li>
                      <li>
                        Questions: {mappingCompleteness.questionCount}/
                        {mappingCompleteness.expectedQuestions}
                      </li>
                      <li>
                        Missing passage: {mappingCompleteness.missingPassage}
                      </li>
                      <li>Missing audio: {mappingCompleteness.missingAudio}</li>
                      <li>
                        Incomplete sections:{" "}
                        {mappingCompleteness.incompleteSections}
                      </li>
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Mapping metrics shown for Reading/Listening shells.
                    </p>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shortcuts
                  </p>
                  <div className="grid gap-2">
                    <Link
                      href="/dashboard/admin/question-map"
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Legacy assignment wizard
                    </Link>
                    <Link
                      href={`/dashboard/admin/resources/${selectedTest.id}/questions`}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Legacy question manager
                    </Link>
                    <Link
                      href="/dashboard/admin/resources"
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Legacy shell list
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Select a shell in Step 2 to inspect full details.
              </p>
            )}
          </aside>
        </section>
      ) : null}

      {passagesLoading && step === 2 ? (
        <p className="text-xs text-slate-500">Loading passage library...</p>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-brand-purple/15 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function FieldInline({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
      <span>{label}</span>
      {children}
    </label>
  );
}
