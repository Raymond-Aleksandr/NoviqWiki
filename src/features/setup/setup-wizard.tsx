"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Rocket } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import type { ActionState } from "@/lib/action-state";
import type { SetupMessages } from "./messages";
import { getSetupSteps, type SetupMode, type SetupValues } from "./model";
import { validateSetupStep, type SetupValidationIssue } from "./validation";
import { SiteStep } from "./steps/site-step";
import { AccessStep } from "./steps/access-step";
import { StorageStep } from "./steps/storage-step";
import { OwnerStep } from "./steps/owner-step";
import { ReviewStep } from "./steps/review-step";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initialValues: SetupValues;
  mode: SetupMode;
  setupTokenRequired: boolean;
  messages: SetupMessages;
};

const initialActionState: ActionState = { ok: true };

export function SetupWizard({ action, initialValues, mode, setupTokenRequired, messages }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [values, setValues] = useState(initialValues);
  const [issue, setIssue] = useState<SetupValidationIssue>();
  const [actionState, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(activeStep);
  const submissionInFlight = useRef(false);
  const steps = getSetupSteps(mode, messages);
  const current = steps[activeStep];
  const progress = Math.round(((activeStep + 1) / steps.length) * 100);
  const ownerOnly = mode === "owner";

  useEffect(() => {
    if (issue) {
      formRef.current?.querySelector<HTMLInputElement>(`[data-setup-field="${issue.field}"]`)?.focus();
    } else if (previousStep.current !== activeStep) {
      headingRef.current?.focus();
    }
    previousStep.current = activeStep;
  }, [activeStep, issue]);

  useEffect(() => {
    submissionInFlight.current = pending;
  }, [pending]);

  function update<K extends keyof SetupValues>(key: K, value: SetupValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setIssue(undefined);
  }

  function navigate(index: number) {
    setIssue(undefined);
    setActiveStep(index);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (pending || submissionInFlight.current) {
      event.preventDefault();
      return;
    }
    if (current.id !== "review") {
      event.preventDefault();
      const nextIssue = validateSetupStep(current.id, values, messages, setupTokenRequired);
      if (nextIssue) {
        setIssue(nextIssue);
        return;
      }
      navigate(activeStep + 1);
      return;
    }

    for (const [index, step] of steps.entries()) {
      const nextIssue = validateSetupStep(step.id, values, messages, setupTokenRequired);
      if (nextIssue) {
        event.preventDefault();
        setActiveStep(index);
        setIssue(nextIssue);
        return;
      }
    }
    submissionInFlight.current = true;
  }

  const fieldProps = { values, onChange: update, messages, disabled: pending, issue };

  return (
    <section className="setup-shell">
      <div className="setup-hero">
        <div className="setup-hero-content">
          <PageHeader
            title={ownerOnly ? messages.ownerBootstrapTitle : messages.setupTitle}
            eyebrow={ownerOnly ? messages.ownerBootstrapKicker : messages.firstRunSetup}
            description={ownerOnly ? messages.ownerBootstrapIntro : messages.setupIntro}
          />
        </div>
      </div>

      <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="setup-wizard" aria-busy={pending} noValidate>
        {Object.entries(values).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}

        <aside className="setup-stepper" aria-label={messages.setupStepsLabel}>
          <div
            className="setup-progress"
            role="progressbar"
            aria-label={messages.setupStepsLabel}
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={activeStep + 1}
            aria-valuetext={`${activeStep + 1} / ${steps.length} · ${current.title}`}
          >
            <span style={{ inlineSize: `${progress}%` }} />
          </div>
          <ol className="setup-step-list">
            {steps.map((step, index) => (
              <li key={step.id}>
                <button
                  type="button"
                  className={`setup-step${index === activeStep ? " current" : ""}${index < activeStep ? " done" : ""}`}
                  aria-current={index === activeStep ? "step" : undefined}
                  disabled={index > activeStep || pending}
                  onClick={() => navigate(index)}
                >
                  <span className="setup-step-index" aria-hidden="true">
                    {index < activeStep ? <Check size={15} /> : index + 1}
                  </span>
                  <span><span className="setup-step-eyebrow">{step.eyebrow}</span><strong>{step.title}</strong></span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <div className="setup-card" role="region" aria-labelledby="setup-step-title">
          <div className="setup-card-header">
            <p className="setup-kicker">{current.eyebrow}</p>
            <h2 id="setup-step-title" ref={headingRef} tabIndex={-1}>{current.title}</h2>
            <p className="muted">{current.description}</p>
          </div>

          {current.id === "site" ? <SiteStep {...fieldProps} /> : null}
          {current.id === "access" ? <AccessStep {...fieldProps} /> : null}
          {current.id === "storage" ? <StorageStep mediaDriver={values.mediaDriver} messages={messages} /> : null}
          {current.id === "owner" ? <OwnerStep {...fieldProps} setupTokenRequired={setupTokenRequired} /> : null}
          {current.id === "review" ? <ReviewStep values={values} mode={mode} messages={messages} /> : null}

          {issue ? <p id="setup-validation-message" role="alert" className="error">{issue.message}</p> : null}
          <div role="status" aria-live="polite" aria-atomic="true">
            {pending ? (
              <p className="muted">{ownerOnly ? messages.creatingOwner : messages.creatingSite}</p>
            ) : actionState.message ? (
              <p className={actionState.ok ? "meta" : "error"}>{actionState.message}</p>
            ) : null}
          </div>

          <div className="setup-actions">
            <button type="button" onClick={() => navigate(activeStep - 1)} disabled={activeStep === 0 || pending}>
              <ChevronLeft size={15} aria-hidden="true" />{messages.back}
            </button>
            {current.id !== "review" ? (
              <button key="continue" type="submit" className="primary" disabled={pending}>
                {messages.continue}<ChevronRight size={15} aria-hidden="true" />
              </button>
            ) : (
              <button key="submit" type="submit" className="primary" disabled={pending}>
                <Rocket size={15} aria-hidden="true" />
                {pending
                  ? ownerOnly ? messages.creatingOwner : messages.creatingSite
                  : ownerOnly ? messages.completeOwnerSetup : messages.completeSetup}
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
