import { useState } from 'react'
import { authErrorText, dismissAuthError, signInWithGoogle, useAuthUi } from '../lib/auth'
import { T, useLang } from '../lib/i18n'
import { Settings } from './Settings'
import { Brand, Page } from './Shell'
import { GlassIconButton, IconGear, IconX } from './ui'

/** Anmeldung nur mit Google (Weiterleitung, kein Pop-up). */
export function Login() {
  useLang()
  const { finishing, redirecting, error } = useAuthUi()
  const [settings, setSettings] = useState(false)

  return (
    <Page
      left={<Brand />}
      actions={
        <GlassIconButton label={T('Einstellungen', 'Settings')} onClick={() => setSettings(true)}>
          <IconGear />
        </GlassIconButton>
      }
    >
      <div className="mx-auto max-w-sm pt-[8vh]">
        <div className="mb-6 text-center">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="mx-auto size-20 rounded-[18px] shadow-lg" />
          <h1 className="t-title mt-4">Gewohnheiten</h1>
          <p className="t-sub mt-1 text-ink-2">{T('Jeden Tag ein kleines Stück.', 'A little bit every day.')}</p>
        </div>
        <div className="card space-y-4 p-5">
          {finishing ? (
            <p className="t-sub flex min-h-11 items-center justify-center gap-2 text-ink-2" role="status">
              <span className="spinner" aria-hidden />
              {T('Anmeldung wird abgeschlossen …', 'Finishing sign-in …')}
            </p>
          ) : (
            <>
              <p className="t-sub text-ink-2">
                {T(
                  'Melde dich mit deinem Google-Konto an. Deine Gewohnheiten sind dann auf allen deinen Geräten da.',
                  'Sign in with your Google account. Your habits will then be on all your devices.',
                )}
              </p>
              <GoogleButton busy={redirecting} onClick={() => void signInWithGoogle()} />
            </>
          )}
          {error && (
            <div className="flex items-start gap-2" role="alert">
              <p className="t-sub flex-1 text-danger">{authErrorText(error)}</p>
              <button onClick={dismissAuthError} className="-m-2 flex size-11 shrink-0 items-center justify-center text-ink-2" aria-label={T('Meldung schließen', 'Dismiss message')}>
                <IconX />
              </button>
            </div>
          )}
          <p className="t-foot text-center text-ink-2">
            {T(
              'Mit derselben E-Mail-Adresse wie in Zählerstände landest du in deinem bisherigen Konto.',
              'Use the same email address as in Zählerstände to get to your existing account.',
            )}
          </p>
        </div>
      </div>
      {settings && <Settings signedIn={false} onClose={() => setSettings(false)} />}
    </Page>
  )
}

/** Knopf nach Googles Gestaltungsregeln: offizielles „G“, hell bzw. dunkel passend zum Thema. */
function GoogleButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button type="button" className="gsi-btn" onClick={onClick} disabled={busy} aria-busy={busy}>
      <GoogleLogo />
      <span>{busy ? T('Google wird geöffnet …', 'Opening Google …') : T('Mit Google anmelden', 'Sign in with Google')}</span>
    </button>
  )
}

function GoogleLogo() {
  return (
    <svg className="gsi-logo" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
