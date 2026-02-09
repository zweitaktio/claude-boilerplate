const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL ?? 'http://localhost:4445'

interface OAuthClient {
  client_id: string
  client_secret: string
  grant_types: string[]
  redirect_uris?: string[]
  response_types?: string[]
  scope: string
  subject_type?: string
  token_endpoint_auth_method: string
}

// Define your OAuth2 clients here.
// Adjust client IDs, scopes, and redirect URIs for your project.
const clients: OAuthClient[] = [
  // Frontend client — user authentication via authorization code flow
  {
    client_id: 'myproject-frontend',
    client_secret: 'frontend-secret-change-in-prod',
    grant_types: ['authorization_code', 'refresh_token'],
    redirect_uris: ['http://localhost:5173/oauth/callback'],
    response_types: ['code'],
    scope: 'openid offline offline_access profile email',
    subject_type: 'public',
    token_endpoint_auth_method: 'client_secret_post',
  },
  // M2M client — server-to-server communication (frontend server -> backend API)
  {
    client_id: 'myproject-m2m',
    client_secret: 'm2m-secret-change-in-prod',
    grant_types: ['client_credentials'],
    scope: 'payload:read payload:write',
    token_endpoint_auth_method: 'client_secret_basic',
  },
  // Backend introspection client — validates tokens from frontend
  {
    client_id: 'myproject-api',
    client_secret: 'api-secret-change-in-prod',
    grant_types: ['client_credentials'],
    scope: 'hydra.introspect',
    token_endpoint_auth_method: 'client_secret_basic',
  },
]

async function waitForHydra(): Promise<void> {
  console.log('Waiting for Hydra to be ready...')

  while (true) {
    try {
      const response = await fetch(`${HYDRA_ADMIN_URL}/health/ready`)
      if (response.ok) {
        console.log('Hydra is ready!\n')
        return
      }
    } catch {
      // Hydra not ready yet
    }
    console.log('  Hydra not ready yet, waiting...')
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}

async function deleteClient(clientId: string): Promise<void> {
  try {
    await fetch(`${HYDRA_ADMIN_URL}/admin/clients/${clientId}`, {
      method: 'DELETE',
    })
  } catch {
    // Client may not exist
  }
}

async function createClient(client: OAuthClient): Promise<void> {
  console.log(`Creating OAuth2 client: ${client.client_id}`)

  await deleteClient(client.client_id)

  try {
    const response = await fetch(`${HYDRA_ADMIN_URL}/admin/clients`, {
      body: JSON.stringify(client),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    if (response.ok) {
      console.log(`  -> Created successfully!`)
    } else {
      const error = await response.text()
      console.log(`  -> Error: ${response.status} - ${error}`)
    }
  } catch (error) {
    console.log(`  -> Failed: ${error}`)
  }
}

async function main(): Promise<void> {
  await waitForHydra()

  for (const client of clients) {
    await createClient(client)
  }

  console.log('\nOAuth2 clients configured!')
  console.log(`\nVerify clients at: ${HYDRA_ADMIN_URL}/admin/clients`)
}

main().catch(console.error)
