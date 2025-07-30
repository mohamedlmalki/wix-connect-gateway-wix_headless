// src/sites.config.ts

// This is the list of all the Wix Headless projects your application can control.
// To add a new site, just add a new object to this array with its name
// and the Client ID you get from the Wix dashboard.
export const managedSites = [
    {
        name: 'My Core Website',
        clientId: 'c84f39bd-6e32-448c-966e-e6bbc859e110', // Replace with the real Client ID
    },
    {
        name: 'My Other Site A',
        clientId: 'REPLACE_WITH_CLIENT_ID_FOR_SITE_A',
    },
    // Add more sites here as needed
];