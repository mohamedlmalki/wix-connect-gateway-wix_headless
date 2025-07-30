import { createClient, OAuthStrategy } from '@wix/sdk';

// This is a cache to hold a separate client for each of your sites.
const clients = new Map();

// This is a new, smarter function that gets or creates a client for a specific site.
// It uses dynamic imports to avoid the startup crash.
export const getWixClient = async (clientId: string) => {
    // If we haven't created a client for this site yet, we'll create one now.
    if (!clients.has(clientId)) {
        console.log(`Creating new Wix client for: ${clientId}`);

        // These 'await import(...)' lines dynamically load the Wix libraries
        // only when they are needed, which is the fix for the startup error.
        const { members } = await import('@wix/members');
        const { contacts } = await import('@wix/contacts');

        // Create the new client with the dynamically imported modules.
        const newClient = createClient({
            modules: {
                members,
                contacts
            },
            auth: OAuthStrategy({
                clientId: clientId
            }),
        });
        // Save the new client in our cache so we don't have to create it again.
        clients.set(clientId, newClient);
    }
    // Return the correct client from our cache.
    return clients.get(clientId);
};