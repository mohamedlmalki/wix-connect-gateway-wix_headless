import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
// ★★★ ADD: Import Dialog components for the notes popup ★★★
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import { Building, PlusCircle, RefreshCw, Terminal, Trash2, Globe, StickyNote, Notebook } from "lucide-react"; 
import Navbar from "@/components/Navbar";

const API_BASE_URL = "/_functions";

interface LogEntry {
    _id: string;
    _createdDate: string;
    message: string;
    status: 'SUCCESS' | 'ERROR' | 'INFO';
    context: string;
}

// ★★★ UPDATE: Add new optional fields to the interface ★★★
interface ManagedSite {
    _id: string;
    siteName: string;
    siteId: string;
    templateId?: string;
    siteDomain?: string; // New field
    notes?: string;      // New field
}

const SiteManagement = () => {
    // State for the form fields
    const [siteName, setSiteName] = useState("");
    const [siteId, setSiteId] = useState("");
    const [clientId, setClientId] = useState("");
    const [templateId, setTemplateId] = useState("");
    // ★★★ ADD: State for the new fields ★★★
    const [siteDomain, setSiteDomain] = useState("");
    const [notes, setNotes] = useState("");

    // State for displaying data and loading states
    const [sites, setSites] = useState<ManagedSite[]>([]);
    const [isLoadingSites, setIsLoadingSites] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(true);
    const [isClearingLogs, setIsClearingLogs] = useState(false);

    const fetchLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const response = await fetch(`${API_BASE_URL}/logs`);
            if (!response.ok) throw new Error('Failed to fetch logs.');
            const logData = await response.json();
            setLogs(logData);
        } catch (error) {
            console.error(error);
            toast.error("Could not load backend activity logs.");
        } finally {
            setIsLoadingLogs(false);
        }
    };
    
    const handleClearLogs = async () => {
        setIsClearingLogs(true);
        try {
            const response = await fetch(`${API_BASE_URL}/clearLogs`, { method: 'POST' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to clear logs.');
            }
            toast.success(`Successfully cleared log entries.`);
            await fetchLogs();
        } catch (error) {
            if (error instanceof Error) toast.error(error.message);
        } finally {
            setIsClearingLogs(false);
        }
    };

    const loadSites = async () => {
        setIsLoadingSites(true);
        try {
            const response = await fetch(`${API_BASE_URL}/listSites`);
            if (!response.ok) throw new Error('Failed to fetch sites.');
            const data = await response.json();
            setSites(data);
        } catch (error) {
            console.error(error);
            toast.error("Error fetching managed sites.");
        } finally {
            setIsLoadingSites(false);
        }
    };

    useEffect(() => {
        loadSites();
        fetchLogs(); 
    }, []);

    const handleAddSite = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        
        try {
            // ★★★ UPDATE: Include new fields in the data sent to the backend ★★★
            const siteData = {
                siteName,
                siteId,
                apiKey: clientId,
                templateId,
                siteDomain,
                notes
            };
            
            const response = await fetch(`${API_BASE_URL}/addSite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(siteData),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'An unknown error occurred.');
            }
            toast.success(`Site "${siteName}" added successfully!`);
            
            // ★★★ UPDATE: Clear all fields, including the new ones ★★★
            setSiteName(""); setSiteId(""); setClientId(""); setTemplateId(""); setSiteDomain(""); setNotes("");
            await Promise.all([loadSites(), fetchLogs()]);
        } catch (error) {
            if (error instanceof Error) toast.error(`Failed to add site: ${error.message}`);
            await fetchLogs();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSite = async (itemId: string, siteName: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/deleteSite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete site.');
            }
            toast.success(`Site "${siteName}" was deleted successfully.`);
            await Promise.all([loadSites(), fetchLogs()]);
        } catch (error) {
            if (error instanceof Error) toast.error(error.message);
            await fetchLogs();
        }
    };

    const getStatusColor = (status: LogEntry['status']) => {
        switch (status) {
            case 'SUCCESS': return 'text-green-400';
            case 'ERROR': return 'text-red-400';
            case 'INFO': return 'text-blue-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-subtle">
            <Navbar />
            <div className="container mx-auto px-4 pt-24 pb-12">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="flex items-center gap-4 animate-fade-in"><Building className="h-10 w-10 text-primary" /><div><h1 className="text-3xl font-bold">Site Management</h1><p className="text-muted-foreground">Add, view, and remove your managed Wix sites.</p></div></div>
                    
                    {/* ★★★ UPDATE: Form now includes Site Domain and Notes ★★★ */}
                    <Card className="bg-gradient-card shadow-card border-primary/10">
                        <form onSubmit={handleAddSite}>
                            <CardHeader><CardTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5" />Add a New Site</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2"><Label htmlFor="siteName">Site Name</Label><Input id="siteName" name="siteName" placeholder="e.g., My Awesome Blog" value={siteName} onChange={(e) => setSiteName(e.target.value)} required /></div>
                                <div className="space-y-2"><Label htmlFor="siteId">Site ID</Label><Input id="siteId" name="siteId" placeholder="Enter the Wix Site ID" value={siteId} onChange={(e) => setSiteId(e.target.value)} required /></div>
                                <div className="space-y-2"><Label htmlFor="siteDomain">Site Domain</Label><Input id="siteDomain" name="siteDomain" placeholder="e.g., my-site.wixsite.com/example" value={siteDomain} onChange={(e) => setSiteDomain(e.target.value)} required /></div>
                                <div className="space-y-2"><Label htmlFor="clientId">Client ID (API Key)</Label><Input id="clientId" name="clientId" placeholder="Enter the Account API Key" value={clientId} onChange={(e) => setClientId(e.target.value)} required /></div>
                                <div className="space-y-2 md:col-span-2"><Label htmlFor="templateId">Triggered Email Template ID</Label><Input id="templateId" name="templateId" placeholder="e.g., welcomeEmail" value={templateId} onChange={(e) => setTemplateId(e.target.value)} required /></div>
                                <div className="space-y-2 md:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" placeholder="Add any relevant notes here..." value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                            </CardContent>
                            <CardFooter><Button type="submit" disabled={isSubmitting} className="gap-2">{isSubmitting ? 'Adding...' : 'Add Site'}</Button></CardFooter>
                        </form>
                    </Card>

                    {/* ★★★ UPDATE: Table now has View Notes button ★★★ */}
                    <Card className="bg-gradient-card shadow-card border-primary/10">
                        <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Managed Sites</CardTitle><CardDescription>List of all sites currently managed by this application.</CardDescription></div><Button variant="outline" size="icon" onClick={loadSites} disabled={isLoadingSites}><RefreshCw className={`h-4 w-4 ${isLoadingSites ? 'animate-spin' : ''}`} /></Button></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Site Name</TableHead>
                                        <TableHead>Site Domain</TableHead>
                                        <TableHead>Template ID</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingSites ? (<TableRow><TableCell colSpan={4} className="text-center">Loading sites...</TableCell></TableRow>) 
                                    : sites.length > 0 ? (sites.map((site) => (
                                        <TableRow key={site._id}>
                                            <TableCell className="font-medium">{site.siteName}</TableCell>
                                            <TableCell>{site.siteDomain || 'N/A'}</TableCell>
                                            <TableCell>{site.templateId || 'N/A'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button variant="outline" size="sm" disabled={!site.notes}>View Notes</Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader><DialogTitle>Notes for {site.siteName}</DialogTitle></DialogHeader>
                                                            <p className="py-4 whitespace-pre-wrap">{site.notes}</p>
                                                            <DialogClose asChild><Button type="button" variant="secondary">Close</Button></DialogClose>
                                                        </DialogContent>
                                                    </Dialog>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Delete</Button></AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the <strong>{site.siteName}</strong> entry.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteSite(site._id, site.siteName)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, delete it</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))) : (<TableRow><TableCell colSpan={4} className="text-center">No managed sites found.</TableCell></TableRow>)}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* ★★★ Logs section is fully restored ★★★ */}
                    <Card className="bg-gradient-card shadow-card border-primary/10">
                        <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2"><Terminal className="h-5 w-5" />Backend Activity Log</CardTitle><CardDescription>Recent events from the backend functions.</CardDescription></div><div className="flex items-center gap-2"><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" disabled={isClearingLogs}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear All Logs?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleClearLogs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isClearingLogs ? 'Clearing...' : 'Yes, Clear Logs'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><Button variant="outline" size="icon" onClick={fetchLogs} disabled={isLoadingLogs}><RefreshCw className={`h-4 w-4 ${isLoadingLogs ? 'animate-spin' : ''}`} /></Button></div></CardHeader>
                        <CardContent>
                            <div className="bg-gray-900 text-white font-mono text-sm p-4 rounded-md h-64 overflow-y-auto">
                                {isLoadingLogs ? ( <p>Loading logs...</p> ) : 
                                 logs.length > 0 ? (
                                     logs.map(log => (
                                         log && <div key={log._id} className="whitespace-pre-wrap">
                                             <span>{new Date(log._createdDate).toLocaleTimeString()}&nbsp;</span>
                                             <span className={getStatusColor(log.status)}>[{log.status}]</span>
                                             <span>&nbsp;{log.message}</span>
                                         </div>
                                     ))
                                 ) : ( <p>No log entries found.</p> )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SiteManagement;