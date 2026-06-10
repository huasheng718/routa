"use client";

import { FilePlus2, FileText, Image, Trash2, Upload, Video, X } from "lucide-react";
import { useTranslation } from "@/i18n";
import {
  formatFileSize,
  formatTemplate,
  getAttachmentCategory,
  validateSpecIssueAttachments,
  type CreateIssueForm,
} from "./spec-page-helpers";

function AttachmentUploadList({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {files.map((file, index) => {
        const category = getAttachmentCategory(file);
        const Icon = category === "image" ? Image : category === "video" ? Video : FileText;
        return (
          <div
            key={`${file.name}-${file.size}-${index}`}
            className="flex items-center gap-2 rounded-lg border border-black/6 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.05]"
          >
            <Icon className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-300" strokeWidth={1.8} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {file.name}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatFileSize(file.size)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={formatTemplate(t.specBoard.createIssueRemoveAttachment, { name: file.name })}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function CreateIssueDialog({
  form,
  creating,
  error,
  onFormChange,
  onError,
  onCancel,
  onSubmit,
}: {
  form: CreateIssueForm;
  creating: boolean;
  error: string | null;
  onFormChange: (form: CreateIssueForm) => void;
  onError: (error: string | null) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const inputClassName =
    "h-11 rounded-lg border border-black/8 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15 dark:border-white/10 dark:bg-[#0c121b] dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-sky-400/60 dark:focus:ring-sky-400/15";
  const labelClassName = "flex flex-col gap-1.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200";
  const titleError = error === t.specBoard.createIssueTitleRequired ? error : null;
  const formError = error && !titleError ? error : null;
  const acceptedFileTypes = [
    ".doc",
    ".docx",
    ".pdf",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".txt",
    ".md",
    "image/*",
    "video/*",
  ].join(",");
  const severityOptions = [
    ["critical", t.specBoard.severityCritical],
    ["high", t.specBoard.severityHigh],
    ["medium", t.specBoard.severityMedium],
    ["low", t.specBoard.severityLow],
    ["info", t.specBoard.severityInfo],
  ] as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-spec-issue-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-3 py-4 backdrop-blur-sm sm:px-6"
    >
      <form
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f1722]"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="border-b border-black/6 bg-[#f8fafc] px-4 py-4 dark:border-white/10 dark:bg-[#111923] sm:px-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-200">
              <FilePlus2 className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="create-spec-issue-title" className="text-base font-semibold text-slate-950 dark:text-slate-50">
                {t.specBoard.createIssueTitle}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                {t.specBoard.createIssueDescription}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={creating}
              aria-label={t.common.cancel}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <section className="space-y-3 rounded-xl border border-black/6 bg-white p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {t.specBoard.createIssuePrimarySection}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t.specBoard.createIssuePrimaryHint}
                </p>
              </div>

              <label className={labelClassName}>
                <span>{t.specBoard.createIssueTitleLabel}</span>
                <input
                  value={form.title}
                  onChange={(event) => onFormChange({ ...form, title: event.target.value })}
                  aria-label={t.specBoard.createIssueTitleLabel}
                  aria-invalid={Boolean(titleError)}
                  aria-describedby={titleError ? "create-spec-issue-title-error" : undefined}
                  placeholder={t.specBoard.createIssueTitlePlaceholder}
                  className={`${inputClassName} ${titleError ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/15 dark:border-rose-400/40 dark:focus:border-rose-300" : ""}`}
                  autoFocus
                />
                {titleError ? (
                  <span id="create-spec-issue-title-error" role="alert" className="block text-xs font-medium text-rose-600 dark:text-rose-300">
                    {titleError}
                  </span>
                ) : null}
              </label>

              <label className={labelClassName}>
                <span>{t.specBoard.body}</span>
                <textarea
                  value={form.body}
                  onChange={(event) => onFormChange({ ...form, body: event.target.value })}
                  aria-label={t.specBoard.body}
                  placeholder={t.specBoard.createIssueBodyPlaceholder}
                  className="min-h-56 resize-y rounded-lg border border-black/8 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15 dark:border-white/10 dark:bg-[#0c121b] dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-sky-400/60 dark:focus:ring-sky-400/15"
                />
                <span className="block text-xs font-normal leading-5 text-slate-500 dark:text-slate-400">
                  {t.specBoard.createIssueBodyHint}
                </span>
              </label>

              <section className="rounded-xl border border-dashed border-sky-200 bg-sky-50/70 p-3 dark:border-sky-400/25 dark:bg-sky-500/10">
                <div className="flex items-start gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sky-700 shadow-sm dark:bg-white/10 dark:text-sky-200">
                    <Upload className="h-4 w-4" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {t.specBoard.createIssueAttachmentsTitle}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {t.specBoard.createIssueAttachmentsHint}
                    </p>
                  </div>
                </div>

                <label className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-sky-200 bg-white/85 px-3 py-4 text-center transition-colors hover:border-sky-300 hover:bg-white dark:border-sky-400/20 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]">
                  <Upload className="h-5 w-5 text-sky-600 dark:text-sky-200" strokeWidth={1.8} />
                  <span className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {t.specBoard.createIssueAttachmentsAction}
                  </span>
                  <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t.specBoard.createIssueAttachmentsTypes}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept={acceptedFileTypes}
                    aria-label={t.specBoard.createIssueAttachmentsAction}
                    className="sr-only"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      if (files.length > 0) {
                        const nextAttachments = [...form.attachments, ...files];
                        const validationError = validateSpecIssueAttachments(nextAttachments, t);
                        if (validationError) {
                          onError(validationError);
                          event.currentTarget.value = "";
                          return;
                        }
                        onError(null);
                        onFormChange({
                          ...form,
                          attachments: nextAttachments,
                        });
                      }
                      event.currentTarget.value = "";
                    }}
                  />
                </label>

                <AttachmentUploadList
                  files={form.attachments}
                  onRemove={(index) => onFormChange({
                    ...form,
                    attachments: form.attachments.filter((_, currentIndex) => currentIndex !== index),
                  })}
                />
              </section>
            </section>

            <section className="space-y-3 rounded-xl border border-black/6 bg-[#f8fafc] p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {t.specBoard.createIssueMetaSection}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t.specBoard.createIssueMetaHint}
                </p>
              </div>

              <label className={labelClassName}>
                <span>{t.specBoard.area}</span>
                <input
                  value={form.area}
                  onChange={(event) => onFormChange({ ...form, area: event.target.value })}
                  aria-label={t.specBoard.area}
                  placeholder={t.specBoard.createIssueAreaPlaceholder}
                  className={inputClassName}
                />
              </label>

              <label className={labelClassName}>
                <span>{t.specBoard.severity}</span>
                <select
                  value={form.severity}
                  onChange={(event) => onFormChange({ ...form, severity: event.target.value })}
                  aria-label={t.specBoard.severity}
                  className={inputClassName}
                >
                  {severityOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className={labelClassName}>
                <span>{t.specBoard.createIssueTagsLabel}</span>
                <input
                  value={form.tags}
                  onChange={(event) => onFormChange({ ...form, tags: event.target.value })}
                  aria-label={t.specBoard.createIssueTagsLabel}
                  placeholder={t.specBoard.createIssueTagsPlaceholder}
                  className={inputClassName}
                />
                <span className="block text-xs font-normal leading-5 text-slate-500 dark:text-slate-400">
                  {t.specBoard.createIssueTagsHint}
                </span>
              </label>
            </section>
          </div>
        </div>

        <div className="border-t border-black/6 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#0f1722] sm:px-5">
          {formError ? (
            <div
              role="alert"
              className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
            >
              {formError}
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={creating}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-black/8 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-white"
            >
              <FilePlus2 className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span>{creating ? t.specBoard.creatingIssue : t.specBoard.createIssue}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
