"use client";

import { useMemo, useState, useActionState } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { ActionState } from "@/app/actions";
import type { Messages } from "@/i18n";

type SetupValues = {
  siteName: string;
  tagline: string;
  baseUrl: string;
  defaultLocale: "en" | "zh-CN";
  registrationMode: "closed" | "open" | "email_verification" | "invite";
  mediaDriver: "local" | "s3";
  ownerUsername: string;
  ownerEmail: string;
  ownerDisplayName: string;
  ownerPassword: string;
};

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  defaultBaseUrl: string;
  defaultMediaDriver: "local" | "s3";
  initialLocale: "en" | "zh-CN";
  messages: Messages;
};

const initialActionState: ActionState = { ok: true };

export function SetupWizard({
  action,
  defaultBaseUrl,
  defaultMediaDriver,
  initialLocale,
  messages
}: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [localError, setLocalError] = useState("");
  const [actionState, formAction, pending] = useActionState(action, initialActionState);
  const steps = useMemo(
    () =>
      [
        {
          id: "site",
          title: messages.setupSite,
          eyebrow: messages.setupIdentity,
          description: messages.setupSiteDescription
        },
        {
          id: "access",
          title: messages.setupAccess,
          eyebrow: messages.setupPolicy,
          description: messages.setupAccessDescription
        },
        {
          id: "storage",
          title: messages.setupStorage,
          eyebrow: messages.setupMedia,
          description: messages.setupStorageDescription
        },
        {
          id: "owner",
          title: messages.setupOwner,
          eyebrow: messages.setupAccount,
          description: messages.setupOwnerDescription
        },
        {
          id: "review",
          title: messages.setupReview,
          eyebrow: messages.setupLaunch,
          description: messages.setupReviewDescription
        }
      ] as const,
    [messages]
  );
  const [values, setValues] = useState<SetupValues>({
    siteName: "NoviqWiki",
    tagline: messages.modernSelfHostedWiki,
    baseUrl: defaultBaseUrl,
    defaultLocale: initialLocale,
    registrationMode: "closed",
    mediaDriver: defaultMediaDriver,
    ownerUsername: "",
    ownerEmail: "",
    ownerDisplayName: "",
    ownerPassword: ""
  });

  const progress = useMemo(() => Math.round(((activeStep + 1) / steps.length) * 100), [activeStep]);

  function update<K extends keyof SetupValues>(key: K, value: SetupValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setLocalError("");
  }

  function goNext() {
    const error = validateStep(activeStep, values, messages);
    if (error) {
      setLocalError(error);
      return;
    }
    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setLocalError("");
    setActiveStep((current) => Math.max(current - 1, 0));
  }

  const current = steps[activeStep];

  return (
    <section className="setup-shell" aria-labelledby="setup-title">
      <div className="setup-hero">
        <p className="setup-kicker">{messages.firstRunSetup}</p>
        <h1 id="setup-title">{messages.setupTitle}</h1>
        <p>{messages.setupIntro}</p>
      </div>

      <form action={formAction} className="setup-wizard">
        {Object.entries(values).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}

        <aside className="setup-stepper" aria-label={messages.setupStepsLabel}>
          <div className="setup-progress" aria-hidden="true">
            <span style={{ inlineSize: `${progress}%` }} />
          </div>
          {steps.map((step, index) => {
            return (
              <button
                key={step.id}
                type="button"
                className={`setup-step ${index === activeStep ? "current" : ""} ${
                  index < activeStep ? "done" : ""
                }`}
                aria-current={index === activeStep ? "step" : undefined}
                onClick={() => {
                  if (index <= activeStep) {
                    setActiveStep(index);
                    setLocalError("");
                  }
                }}
              >
                <span className="setup-step-index">
                  {index < activeStep ? <Check size={15} aria-hidden="true" /> : index + 1}
                </span>
                <span>
                  <span className="setup-step-eyebrow">{step.eyebrow}</span>
                  <strong>{step.title}</strong>
                </span>
              </button>
            );
          })}
        </aside>

        <div className="setup-card">
          <div className="setup-card-header">
            <p className="setup-kicker">{current.eyebrow}</p>
            <h2>{current.title}</h2>
            <p className="muted">{current.description}</p>
          </div>

          {activeStep === 0 ? (
            <div className="setup-fields">
              <label>
                {messages.siteName}
                <input
                  className="field"
                  value={values.siteName}
                  onChange={(event) => update("siteName", event.target.value)}
                  autoComplete="organization"
                />
              </label>
              <label>
                {messages.tagline}
                <input
                  className="field"
                  value={values.tagline}
                  onChange={(event) => update("tagline", event.target.value)}
                />
              </label>
              <label>
                {messages.baseUrl}
                <input
                  className="field"
                  value={values.baseUrl}
                  onChange={(event) => update("baseUrl", event.target.value)}
                  inputMode="url"
                />
              </label>
              <label>
                {messages.defaultLocale}
                <select
                  value={values.defaultLocale}
                  onChange={(event) =>
                    update("defaultLocale", event.target.value as "en" | "zh-CN")
                  }
                >
                  <option value="zh-CN">{messages.simplifiedChinese}</option>
                  <option value="en">{messages.english}</option>
                </select>
              </label>
            </div>
          ) : null}

          {activeStep === 1 ? (
            <div className="setup-choice-grid">
              <label className="setup-choice radio-row">
                <input
                  type="radio"
                  checked={values.registrationMode === "closed"}
                  onChange={() => update("registrationMode", "closed")}
                />
                <span>
                  <strong>{messages.registrationClosed}</strong>
                  <small>{messages.registrationClosedDescription}</small>
                </span>
              </label>
              <label className="setup-choice radio-row">
                <input
                  type="radio"
                  checked={values.registrationMode === "invite"}
                  onChange={() => update("registrationMode", "invite")}
                />
                <span>
                  <strong>{messages.registrationInvite}</strong>
                  <small>{messages.registrationInviteDescription}</small>
                </span>
              </label>
              <label className="setup-choice radio-row">
                <input
                  type="radio"
                  checked={values.registrationMode === "open"}
                  onChange={() => update("registrationMode", "open")}
                />
                <span>
                  <strong>{messages.registrationOpen}</strong>
                  <small>{messages.registrationOpenDescription}</small>
                </span>
              </label>
              <label className="setup-choice radio-row">
                <input
                  type="radio"
                  checked={values.registrationMode === "email_verification"}
                  onChange={() => update("registrationMode", "email_verification")}
                />
                <span>
                  <strong>{messages.registrationEmailVerification}</strong>
                  <small>{messages.registrationEmailVerificationDescription}</small>
                </span>
              </label>
            </div>
          ) : null}

          {activeStep === 2 ? (
            <div className="setup-choice-grid">
              <label className="setup-choice radio-row">
                <input
                  type="radio"
                  checked={values.mediaDriver === "local"}
                  onChange={() => update("mediaDriver", "local")}
                />
                <span>
                  <strong>{messages.localFilesystem}</strong>
                  <small>{messages.localFilesystemDescription}</small>
                </span>
              </label>
              <label className="setup-choice radio-row">
                <input
                  type="radio"
                  checked={values.mediaDriver === "s3"}
                  onChange={() => update("mediaDriver", "s3")}
                />
                <span>
                  <strong>{messages.s3Storage}</strong>
                  <small>{messages.s3StorageDescription}</small>
                </span>
              </label>
            </div>
          ) : null}

          {activeStep === 3 ? (
            <div className="setup-fields">
              <label>
                {messages.username}
                <input
                  className="field"
                  value={values.ownerUsername}
                  onChange={(event) => update("ownerUsername", event.target.value)}
                  autoComplete="username"
                />
              </label>
              <label>
                {messages.email}
                <input
                  className="field"
                  type="email"
                  value={values.ownerEmail}
                  onChange={(event) => update("ownerEmail", event.target.value)}
                  autoComplete="email"
                />
              </label>
              <label>
                {messages.displayName}
                <input
                  className="field"
                  value={values.ownerDisplayName}
                  onChange={(event) => update("ownerDisplayName", event.target.value)}
                />
              </label>
              <label>
                {messages.password}
                <input
                  className="field"
                  type="password"
                  value={values.ownerPassword}
                  onChange={(event) => update("ownerPassword", event.target.value)}
                  autoComplete="new-password"
                />
              </label>
            </div>
          ) : null}

          {activeStep === 4 ? (
            <div className="setup-review">
              <dl>
                <div>
                  <dt>{messages.setupSite}</dt>
                  <dd>{values.siteName}</dd>
                </div>
                <div>
                  <dt>{messages.baseUrl}</dt>
                  <dd>{values.baseUrl}</dd>
                </div>
                <div>
                  <dt>{messages.defaultLocale}</dt>
                  <dd>
                    {values.defaultLocale === "zh-CN"
                      ? messages.simplifiedChinese
                      : messages.english}
                  </dd>
                </div>
                <div>
                  <dt>{messages.registration}</dt>
                  <dd>{registrationLabel(values.registrationMode, messages)}</dd>
                </div>
                <div>
                  <dt>{messages.mediaStorage}</dt>
                  <dd>
                    {values.mediaDriver === "local" ? messages.localFilesystem : messages.s3Storage}
                  </dd>
                </div>
                <div>
                  <dt>{messages.owner}</dt>
                  <dd>
                    {values.ownerUsername} · {values.ownerEmail}
                  </dd>
                </div>
              </dl>
              <p className="muted">{messages.setupOneTimeNote}</p>
            </div>
          ) : null}

          {localError ? (
            <p role="alert" className="error">
              {localError}
            </p>
          ) : null}
          {actionState.message ? (
            <p role="status" className={actionState.ok ? "meta" : "error"}>
              {actionState.message}
            </p>
          ) : null}

          <div className="setup-actions">
            <button type="button" onClick={goBack} disabled={activeStep === 0 || pending}>
              {messages.back}
            </button>
            {activeStep < steps.length - 1 ? (
              <button
                key="continue"
                type="button"
                className="primary"
                onClick={goNext}
                disabled={pending}
              >
                {messages.continue}
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            ) : (
              <button key="submit" type="submit" className="primary" disabled={pending}>
                {pending ? messages.creatingSite : messages.completeSetup}
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}

function validateStep(step: number, values: SetupValues, messages: Messages) {
  if (step === 0) {
    if (!values.siteName.trim()) return messages.enterSiteName;
    try {
      new URL(values.baseUrl);
    } catch {
      return messages.enterValidBaseUrl;
    }
  }
  if (step === 3) {
    if (!values.ownerUsername.trim()) return messages.enterOwnerUsername;
    if (!/^[A-Za-z0-9_.-]+$/.test(values.ownerUsername)) {
      return messages.usernameCharacters;
    }
    if (!values.ownerEmail.includes("@")) return messages.enterOwnerEmail;
    if (values.ownerPassword.length < 12) return messages.passwordLength;
    if (
      !/[a-z]/.test(values.ownerPassword) ||
      !/[A-Z]/.test(values.ownerPassword) ||
      !/[0-9]/.test(values.ownerPassword)
    ) {
      return messages.passwordComplexity;
    }
  }
  return "";
}

function registrationLabel(mode: SetupValues["registrationMode"], messages: Messages) {
  if (mode === "open") return messages.registrationOpen;
  if (mode === "email_verification") return messages.registrationEmailVerification;
  if (mode === "invite") return messages.registrationInvite;
  return messages.registrationClosed;
}
