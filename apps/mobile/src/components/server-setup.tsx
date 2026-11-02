import { useLingui } from '@lingui/react/macro'
import * as Linking from 'expo-linking'
import { useState } from 'react'
import { Host } from '@/components/host'
import { allowHttp, isConvexServer } from '@/data/server'
import { parseServer } from '@/data/server-address'
import { switchServer } from '@/data/shared-db'
import {
  fillMaxSize,
  fillMaxWidth,
  imePadding,
  padding,
  size,
  verticalScroll,
} from '@/lib/compose-modifiers'
import {
  Box,
  Button,
  Column,
  Icon,
  LoadingIndicator,
  OutlinedTextField,
  Text,
  TextButton,
  useMaterialColors,
  useNativeState,
} from '@/lib/compose-ui'
import { glyphs } from '@/ui/glyphs'

/** How to deploy the backend to a Convex account of one's own. */
export const serverGuideUrl = 'https://github.com/kansson/toda#your-own-server'

/**
 * The first launch of a published build, which carries no server: the phone needs one before it
 * has anything to show. The address must answer as a Convex deployment before it is kept.
 */
export function ServerSetup() {
  const { t } = useLingui()
  const colors = useMaterialColors()
  const text = useNativeState('')
  const [value, setValue] = useState('')
  const [checking, setChecking] = useState(false)
  const [failed, setFailed] = useState(false)
  const server = parseServer(value, allowHttp)

  async function connect() {
    if (!server || checking) return

    setChecking(true)
    setFailed(false)

    try {
      if (!(await isConvexServer(server))) throw new Error('Not a Convex server')
      // The app opens on the server and this page goes.
      await switchServer(server)
    } catch {
      setChecking(false)
      setFailed(true)
    }
  }

  return (
    <Host style={{ flex: 1 }}>
      <Box contentAlignment='center' modifiers={[fillMaxSize(), imePadding()]}>
        <Column
          horizontalAlignment='center'
          verticalArrangement={{ spacedBy: 16 }}
          modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 48, 24, 48)]}
        >
          <Box modifiers={[size(48, 48)]} contentAlignment='center'>
            <Icon source={glyphs.server} size={48} tint={colors.onSurfaceVariant} />
          </Box>
          <Text style={{ typography: 'headlineSmall', textAlign: 'center' }}>
            {t({
              message: 'Connect to your server',
              comment: 'Title of the first-launch page asking for the sync server',
            })}
          </Text>
          <Text
            color={colors.onSurfaceVariant}
            style={{ typography: 'bodyMedium', textAlign: 'center' }}
          >
            {t({
              message:
                'Toda keeps your tasks on a Convex server of your own, and works offline in between. Enter its address to start.',
              comment: 'Explanation on the first-launch server page',
            })}
          </Text>
          <OutlinedTextField
            value={text}
            singleLine
            enabled={!checking}
            isError={failed}
            keyboardOptions={{
              autoCorrectEnabled: false,
              capitalization: 'none',
              keyboardType: 'uri',
              imeAction: 'go',
            }}
            keyboardActions={{ onGo: () => void connect() }}
            onValueChange={(next) => {
              setValue(next)
              setFailed(false)
            }}
            modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}
          >
            <OutlinedTextField.Label>
              <Text>
                {t({ message: 'Server address', comment: 'Field label: the sync server' })}
              </Text>
            </OutlinedTextField.Label>
            <OutlinedTextField.Placeholder>
              <Text>your-deployment.convex.cloud</Text>
            </OutlinedTextField.Placeholder>
            {/* Always there: a slot added after the first draw is never shown. */}
            <OutlinedTextField.SupportingText>
              <Text>
                {failed
                  ? t({
                      message: 'That address isn’t a Convex server, or it can’t be reached now.',
                      comment: 'Error under the server address field',
                    })
                  : ' '}
              </Text>
            </OutlinedTextField.SupportingText>
          </OutlinedTextField>
          {checking ? (
            <LoadingIndicator modifiers={[size(48, 48)]} />
          ) : (
            <Button enabled={server !== null} onClick={() => void connect()}>
              <Text>{t({ message: 'Connect', comment: 'Connects to the typed server' })}</Text>
            </Button>
          )}
          <TextButton onClick={() => void Linking.openURL(serverGuideUrl)}>
            <Text>
              {t({
                message: 'How to set up a server',
                comment: 'Opens the guide to deploying the backend',
              })}
            </Text>
          </TextButton>
        </Column>
      </Box>
    </Host>
  )
}
