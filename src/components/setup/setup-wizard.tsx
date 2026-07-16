"use client";

import { useMemo, useState, useActionState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Globe2,
  HardDrive,
  LoaderCircle,
  Rocket,
  ShieldCheck,
  UserRound
} from "lucide-react";
import type { ActionState } from "@/app/actions";

type SetupValues = {
  siteName: string;
  tagline: string;
  baseUrl: string;
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
};

const initialActionState: ActionState = { ok: true };

const steps = [
  {
    id: "site",
    title: "Site",
    eyebrow: "Identity",
    description: "Name the wiki and set the canonical address.",
    icon: Globe2
  },
  {
    id: "access",
    title: "Access",
    eyebrow: "Policy",
    description: "Choose how new users can enter the wiki.",
    icon: ShieldCheck
  },
  {
    id: "storage",
    title: "Storage",
    eyebrow: "Media",
    description: "Select where uploaded files should live.",
    icon: HardDrive
  },
  {
    id: "owner",
    title: "Owner",
    eyebrow: "Account",
    description: "Create the first administrator account.",
    icon: UserRound
  },
  {
    id: "review",
    title: "Review",
    eyebrow: "Launch",
    description: "Confirm the setup details and create the site.",
    icon: Rocket
  }
] as const;

export function SetupWizard({ action, defaultBaseUrl, defaultMediaDriver }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [localError, setLocalError] = useState("");
  const [actionState, formAction, pending] = useActionState(action, initialActionState);
  const [values, setValues] = useState<SetupValues>({
    siteName: "NoviqWiki",
    tagline: "A modern self-hosted wiki",
    baseUrl: defaultBaseUrl,
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
    const error = validateStep(activeStep, values);
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
        <p className="setup-kicker">First-run setup</p>
        <h1 id="setup-title">Set up NoviqWiki</h1>
        <p>
          Create the first site, choose the access policy, configure media storage, and create the
          Owner account. This route closes permanently after setup succeeds.
        </p>
      </div>

      <form action={formAction} className="setup-wizard">
        {Object.entries(values).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}

        <aside className="setup-stepper" aria-label="Setup steps">
          <div className="setup-progress" aria-hidden="true">
            <span style={{ inlineSize: `${progress}%` }} />
          </div>
          {steps.map((step, index) => {
            const StepIcon = step.icon;
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
                  {index < activeStep ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <StepIcon size={15} aria-hidden="true" />
                  )}
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
                Site name
                <input
                  className="field"
                  value={values.siteName}
                  onChange={(event) => update("siteName", event.target.value)}
                  autoComplete="organization"
                />
              </label>
              <label>
                Tagline
                <input
                  className="field"
                  value={values.tagline}
                  onChange={(event) => update("tagline", event.target.value)}
                />
              </label>
              <label>
                Base URL
                <input
                  className="field"
                  value={values.baseUrl}
                  onChange={(event) => update("baseUrl", event.target.value)}
                  inputMode="url"
                />
              </label>
            </div>
          ) : null}

          {activeStep === 1 ? (
            <div className="setup-choice-grid">
              <label className="setup-choice">
                <input
                  type="radio"
                  checked={values.registrationMode === "closed"}
                  onChange={() => update("registrationMode", "closed")}
                />
                <span>
                  <strong>Closed</strong>
                  <small>Only administrators can create accounts.</small>
                </span>
              </label>
              <label className="setup-choice">
                <input
                  type="radio"
                  checked={values.registrationMode === "invite"}
                  onChange={() => update("registrationMode", "invite")}
                />
                <span>
                  <strong>Invite or administrator-created</strong>
                  <small>Keep public signup disabled while allowing controlled growth.</small>
                </span>
              </label>
              <label className="setup-choice">
                <input
                  type="radio"
                  checked={values.registrationMode === "open"}
                  onChange={() => update("registrationMode", "open")}
                />
                <span>
                  <strong>Open</strong>
                  <small>Anyone can register and receive default permissions.</small>
                </span>
              </label>
              <label className="setup-choice">
                <input
                  type="radio"
                  checked={values.registrationMode === "email_verification"}
                  onChange={() => update("registrationMode", "email_verification")}
                />
                <span>
                  <strong>Email verification required</strong>
                  <small>New accounts must verify email when SMTP is configured.</small>
                </span>
              </label>
            </div>
          ) : null}

          {activeStep === 2 ? (
            <div className="setup-choice-grid">
              <label className="setup-choice">
                <input
                  type="radio"
                  checked={values.mediaDriver === "local"}
                  onChange={() => update("mediaDriver", "local")}
                />
                <span>
                  <strong>Local persistent filesystem</strong>
                  <small>Best default for Docker Compose. Uses the mounted media volume.</small>
                </span>
              </label>
              <label className="setup-choice">
                <input
                  type="radio"
                  checked={values.mediaDriver === "s3"}
                  onChange={() => update("mediaDriver", "s3")}
                />
                <span>
                  <strong>S3-compatible object storage</strong>
                  <small>Use when production media should live outside the app container.</small>
                </span>
              </label>
            </div>
          ) : null}

          {activeStep === 3 ? (
            <div className="setup-fields">
              <label>
                Username
                <input
                  className="field"
                  value={values.ownerUsername}
                  onChange={(event) => update("ownerUsername", event.target.value)}
                  autoComplete="username"
                />
              </label>
              <label>
                Email
                <input
                  className="field"
                  type="email"
                  value={values.ownerEmail}
                  onChange={(event) => update("ownerEmail", event.target.value)}
                  autoComplete="email"
                />
              </label>
              <label>
                Display name
                <input
                  className="field"
                  value={values.ownerDisplayName}
                  onChange={(event) => update("ownerDisplayName", event.target.value)}
                />
              </label>
              <label>
                Password
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
                  <dt>Site</dt>
                  <dd>{values.siteName}</dd>
                </div>
                <div>
                  <dt>Base URL</dt>
                  <dd>{values.baseUrl}</dd>
                </div>
                <div>
                  <dt>Registration</dt>
                  <dd>{registrationLabel(values.registrationMode)}</dd>
                </div>
                <div>
                  <dt>Media storage</dt>
                  <dd>{values.mediaDriver === "local" ? "Local filesystem" : "S3-compatible"}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>
                    {values.ownerUsername} · {values.ownerEmail}
                  </dd>
                </div>
              </dl>
              <p className="muted">
                Setup is a one-time operation. After creation, future changes happen in the admin
                settings area.
              </p>
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
              <ArrowLeft size={15} aria-hidden="true" />
              Back
            </button>
            {activeStep < steps.length - 1 ? (
              <button
                key="continue"
                type="button"
                className="primary"
                onClick={goNext}
                disabled={pending}
              >
                Continue
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            ) : (
              <button key="submit" type="submit" className="primary" disabled={pending}>
                {pending ? (
                  <>
                    <LoaderCircle size={15} aria-hidden="true" className="spin-icon" />
                    Creating site...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    Complete setup
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}

function validateStep(step: number, values: SetupValues) {
  if (step === 0) {
    if (!values.siteName.trim()) return "Enter a site name.";
    try {
      new URL(values.baseUrl);
    } catch {
      return "Enter a valid base URL.";
    }
  }
  if (step === 3) {
    if (!values.ownerUsername.trim()) return "Enter an Owner username.";
    if (!/^[A-Za-z0-9_.-]+$/.test(values.ownerUsername)) {
      return "Username can use letters, numbers, underscore, dot, and hyphen.";
    }
    if (!values.ownerEmail.includes("@")) return "Enter a valid Owner email.";
    if (values.ownerPassword.length < 12) return "Password must be at least 12 characters.";
    if (
      !/[a-z]/.test(values.ownerPassword) ||
      !/[A-Z]/.test(values.ownerPassword) ||
      !/[0-9]/.test(values.ownerPassword)
    ) {
      return "Password must include lowercase, uppercase, and a number.";
    }
  }
  return "";
}

function registrationLabel(mode: SetupValues["registrationMode"]) {
  if (mode === "open") return "Open";
  if (mode === "email_verification") return "Email verification required";
  if (mode === "invite") return "Invite or administrator-created";
  return "Closed";
}
