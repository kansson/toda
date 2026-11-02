import { useLingui } from '@lingui/react/macro'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useAccount } from '@/data/account'
import { refusalCode } from '@/data/errors'
import { usePendingWrites } from '@/data/queries'
import { fillMaxWidth, padding } from '@/lib/compose-modifiers'
import {
  Button,
  Column,
  FilledTonalButton,
  LoadingIndicator,
  Text,
  useMaterialColors,
} from '@/lib/compose-ui'
import { useFeedback } from '@/lib/feedback'
import { ConfirmDialog, TextDialog } from '@/ui/dialogs'
import { List, Notice, Section } from '@/ui/primitives'
import { Screen } from '@/ui/screen'

/** `ABCD EFGH`, read aloud or typed more easily than eight letters in a row. */
function spaced(code: string) {
  return `${code.slice(0, 4)} ${code.slice(4)}`
}

/**
 * Shares the tasks with another phone: this phone shows a code for ten minutes, and the other
 * phone types it under "I have a code", joining this account. Joining replaces what the joining
 * phone had.
 */
export function LinkScreen() {
  const { t } = useLingui()
  const router = useRouter()
  const colors = useMaterialColors()
  const account = useAccount()
  const pending = usePendingWrites()
  const { showFeedback } = useFeedback()
  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [making, setMaking] = useState(false)
  const [entering, setEntering] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)

    return () => clearInterval(timer)
  }, [])

  const live = code !== null && code.expiresAt > now
  const left = live ? Math.ceil((code.expiresAt - now) / 60_000) : 0

  async function make() {
    setMaking(true)

    try {
      setCode(await account.createPairingCode())
    } catch {
      showFeedback(
        t({
          message: 'Couldn’t make a code. Check your connection.',
          comment: 'Snackbar when no pairing code could be made',
        }),
      )
    } finally {
      setMaking(false)
    }
  }

  async function join(value: string) {
    setJoining(true)

    try {
      await account.join(value)
      showFeedback(
        t({
          message: 'This phone now shares the other phone’s tasks',
          comment: 'Snackbar after joining',
        }),
      )
      router.dismissTo('/')
    } catch (error) {
      setJoining(false)
      showFeedback(
        error instanceof Error && refusalCode(error) === 'PAIRING_CODE_INVALID'
          ? t({
              message: 'That code is wrong or has expired',
              comment: 'Snackbar for a bad pairing code',
            })
          : t({
              message: 'Couldn’t join. Check your connection.',
              comment: 'Snackbar when joining failed',
            }),
      )
    }
  }

  return (
    <Screen
      title={t({ message: 'Link another phone', comment: 'Title of the pairing screen' })}
      navigation='back'
    >
      <List grouped>
        <Section
          title={t({ message: 'Share these tasks', comment: 'Pairing section: making a code' })}
        >
          <Text color={colors.onSurfaceVariant}>
            {t({
              message:
                'Make a code here, then type it on the other phone under “I have a code”. It works once, for ten minutes.',
              comment: 'Pairing explanation',
            })}
          </Text>
          {live ? (
            <Column
              horizontalAlignment='center'
              modifiers={[fillMaxWidth(), padding(0, 8, 0, 8)]}
              verticalArrangement={{ spacedBy: 8 }}
            >
              <Text
                color={colors.primary}
                style={{ typography: 'displaySmall', fontFamily: 'monospace', letterSpacing: 4 }}
              >
                {spaced(code.code)}
              </Text>
              <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>
                {t({ message: `Expires in ${left} min`, comment: 'Pairing code lifetime left' })}
              </Text>
              <FilledTonalButton
                onClick={() => {
                  void Clipboard.setStringAsync(code.code)
                  showFeedback(
                    t({ message: 'Code copied', comment: 'Snackbar after copying the code' }),
                  )
                }}
              >
                <Text>{t({ message: 'Copy code', comment: 'Copies the pairing code' })}</Text>
              </FilledTonalButton>
            </Column>
          ) : making ? (
            <LoadingIndicator />
          ) : (
            <Button onClick={() => void make()}>
              <Text>{t({ message: 'Make a code', comment: 'Creates a pairing code' })}</Text>
            </Button>
          )}
        </Section>
        <Section
          title={t({
            message: 'Use another phone’s tasks',
            comment: 'Pairing section: typing a code',
          })}
        >
          <Text color={colors.onSurfaceVariant}>
            {t({
              message: 'This phone then shows the other phone’s lists instead of its own.',
              comment: 'Pairing explanation for the joining phone',
            })}
          </Text>
          {joining ? (
            <LoadingIndicator />
          ) : (
            <FilledTonalButton onClick={() => setEntering(true)}>
              <Text>
                {t({ message: 'I have a code', comment: 'Opens the field for a pairing code' })}
              </Text>
            </FilledTonalButton>
          )}
        </Section>
        {pending > 0 ? (
          <Notice
            glyph='pending'
            message={t({
              message: `${pending} changes here are not synced yet; joining another phone drops them.`,
              comment: 'Warning before joining with unsent changes',
            })}
          />
        ) : null}
      </List>
      {entering ? (
        <TextDialog
          title={t({ message: 'Enter the code', comment: 'Dialog title' })}
          label={t({ message: 'Code', comment: 'Field label: the pairing code' })}
          initialValue=''
          maxLength={12}
          code
          confirmLabel={t({ message: 'Continue', comment: 'Continues joining with the code' })}
          onConfirm={(value) => setConfirming(value)}
          onDismiss={() => setEntering(false)}
        />
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title={t({ message: 'Replace this phone’s tasks?', comment: 'Dialog title' })}
          message={t({
            message:
              'The lists on this phone are replaced by the other phone’s. If no other phone shares them, they are deleted.',
            comment: 'Joining warning',
          })}
          confirmLabel={t({ message: 'Join', comment: 'Confirms joining the other account' })}
          onConfirm={() => void join(confirming)}
          onDismiss={() => setConfirming(null)}
        />
      ) : null}
    </Screen>
  )
}
