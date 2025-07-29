import { useState, useEffect, FormEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import { UserPlus, PlayCircle, Building, Terminal, RefreshCw, Trash2, CheckCircle, XCircle, FileJson, Clock, PauseCircle, StopCircle, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

const API_BASE_URL = "/_functions";

interface LogEntry {
    _id: string;
    _createdDate: string;
    status: 'INFO' | 'SUCCESS' | 'ERROR';
    message: string;
    context: string;
}

interface ManagedSite {
    _id: string;
    siteName: string;
    siteId: string;
}

interface ImportResult {
    email: string;
    status: 'SUCCESS' | 'ERROR' | 'PENDING';
    message: string;
    details?: any;
}

// ★★★ This is the interface for the selected member object ★★★
interface MemberToDelete {
    memberId: string;
    contactId: string;
}

const AdminImport = () => {
    const [sites, setSites] = useState<ManagedSite[]>([]);
    const [selectedSite, setSelectedSite] = useState("");
    const [isLoadingSites, setIsLoadingSites] = useState(true);
    const [recipientEmails, setRecipientEmails] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customSubject, setCustomSubject] = useState("Welcome to Our Community!");
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(true);
    const [isClearingLogs, setIsClearingLogs] = useState(false);
    const [importResults, setImportResults] = useState<ImportResult[]>([]);
    const [emailCount, setEmailCount] = useState(0);
    const [delaySeconds, setDelaySeconds] = useState(3);
    const [progress, setProgress] = useState(0);
    const [countdown, setCountdown] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const jobPaused = useRef(false);
    const jobCancelled = useRef(false);
    // ★★★ State for Search and Delete is added back ★★★
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<MemberToDelete[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);


    useEffect(() => {
        const emails = recipientEmails.split(/[,\s\n]+/).map(email => email.trim()).filter(email => email.includes('@'));
        setEmailCount(emails.length);
    }, [recipientEmails]);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const loadSites = async () => {
        setIsLoadingSites(true);
        try {
            const response = await fetch(`${API_BASE_URL}/listSites`);
            if (!response.ok) throw new Error('Failed to fetch sites.');
            const siteList = await response.json();
            setSites(siteList);
            if (siteList.length > 0 && !selectedSite) {
                setSelectedSite(siteList[0].siteId);
            }
        } catch (error: any) {
            toast.error("Error loading sites", { description: error.message });
        } finally {
            setIsLoadingSites(false);
        }
    };

    const fetchLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const response = await fetch(`${API_BASE_URL}/logs`);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to fetch logs.');
            };
            const logData = await response.json();
            setLogs(logData);
        } catch (error: any) {
            toast.error("Error loading logs", { description: error.message });
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // ... (This function is unchanged) ...
        if (!selectedSite || !recipientEmails) {
            toast.warning("Missing Information", { description: "Please select a site and provide at least one email." });
            return;
        }
        jobCancelled.current = false;
        jobPaused.current = false;
        setIsPaused(false);
        setIsSubmitting(true);
        setProgress(0);
        setImportResults([]);
        const emailsToImport = recipientEmails
            .split(/[,\s\n]+/)
            .map(email => email.trim())
            .filter(email => email.includes('@'));
        const totalEmails = emailsToImport.length;
        if (totalEmails === 0) {
            toast.warning("No Valid Emails", { description: "No valid email addresses found to import." });
            setIsSubmitting(false);
            return;
        }
        toast.info(`Starting import for ${totalEmails} user(s)...`);
        for (let i = 0; i < totalEmails; i++) {
            if (jobCancelled.current) {
                toast.error("Import job terminated by user.");
                break;
            }
            while (jobPaused.current) {
                if (jobCancelled.current) break;
                await sleep(200);
            }
            if (jobCancelled.current) break;
            const email = emailsToImport[i];
            if (i > 0 && delaySeconds > 0) {
                for (let j = delaySeconds; j > 0; j--) {
                    if (jobCancelled.current || jobPaused.current) break;
                    setCountdown(j);
                    await sleep(1000);
                }
                setCountdown(0);
            }
            if (jobCancelled.current || jobPaused.current) continue;
            setImportResults(prev => [...prev, { email, status: 'PENDING', message: 'Importing...' }]);
            try {
                const response = await fetch(`${API_BASE_URL}/importUsers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        targetSiteId: selectedSite,
                        email: email,
                        customSubject: customSubject,
                    })
                });
                const responseText = await response.text();
                if (!responseText) {
                    throw new Error("Received an empty response from the server.");
                }
                const result = JSON.parse(responseText);
                if (!response.ok || result.status === 'ERROR') {
                    throw new Error(result.message || "An unknown error occurred during import.");
                }
                setImportResults(prev => prev.map(res =>
                    res.email === email ? { ...res, status: 'SUCCESS', message: result.message, details: result } : res
                ));
            } catch (error) {
                const errorMessage = (error instanceof Error) ? error.message : "An unknown error occurred.";
                setImportResults(prev => prev.map(res =>
                    res.email === email ? { ...res, status: 'ERROR', message: errorMessage, details: { error: errorMessage } } : res
                ));
            }
            setProgress(((i + 1) / totalEmails) * 100);
        }
        if (!jobCancelled.current) {
            toast.success("Import process finished.");
        }
        setIsSubmitting(false);
        setIsPaused(false);
        await fetchLogs();
    };

    const handlePauseResume = () => {
        const newPausedState = !jobPaused.current;
        jobPaused.current = newPausedState;
        setIsPaused(newPausedState);

        if (newPausedState) {
            toast.info("Import job paused.");
        } else {
            toast.info("Import job resumed.");
        }
    };

    const handleEndJob = () => {
        jobCancelled.current = true;
        jobPaused.current = false;
        setIsPaused(false);
        setIsSubmitting(false);
    };

    // ★★★ Search and Delete functions are added back and corrected ★★★
    const handleSearch = async () => {
        if (!selectedSite) {
            toast.warning("Please select a site to search.");
            return;
        }
        if (!searchQuery) {
            toast.warning("Please enter a search query.");
            return;
        }
        setIsSearching(true);
        setSelectedMembers([]);
        setSearchResults([]);
        toast.info(`Searching for members matching "${searchQuery}"...`);

        try {
            const response = await fetch(`${API_BASE_URL}/searchMembers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetSiteId: selectedSite,
                    query: searchQuery,
                }),
            });
            
            // This assumes your backend sends clean JSON, as per our final fix
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "An unknown search error occurred.");
            }

            // We use the raw members array directly from the API response
            setSearchResults(result.members || []);
            
            const memberCount = result.members ? result.members.length : 0;
            if (memberCount > 0) {
                toast.success(`Search complete. Found ${memberCount} member(s).`);
            } else {
                toast.info("Search complete. No members found matching your query.");
            }

        } catch (error) {
            const errorMessage = (error instanceof Error) ? error.message : "An unknown error occurred.";
            toast.error("Search Failed", { description: errorMessage });
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedMembers.length === 0) return;
        setIsDeleting(true);
        toast.info(`Deleting ${selectedMembers.length} selected member(s)...`);

        try {
            const response = await fetch(`${API_BASE_URL}/deleteMembers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetSiteId: selectedSite,
                    // Send the array of objects to the backend
                    membersToDelete: selectedMembers,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "An unknown error occurred during deletion.");
            }

            toast.success(result.message || "Deletion process initiated successfully.");

        } catch (error) {
            const errorMessage = (error instanceof Error) ? error.message : "A network error occurred.";
            toast.error("Deletion Failed", { description: errorMessage });
        } finally {
            setIsDeleting(false);
            setSelectedMembers([]);
            // Refresh the search to show the members are gone
            await handleSearch();
        }
    };

    useEffect(() => {
        loadSites();
        fetchLogs();
    }, []);

    const getStatusColor = (status: string) => {
        if (status === 'SUCCESS') return 'text-green-400';
        if (status === 'ERROR') return 'text-red-400';
        return 'text-blue-400';
    }

    return (
        <div className="min-h-screen bg-gradient-subtle">
            <Navbar />
            <div className="container mx-auto px-4 pt-24 pb-12">
                <div className="max-w-5xl mx-auto space-y-8">
                    <div className="flex items-center gap-4 animate-fade-in"><UserPlus className="h-10 w-10 text-primary" /><div><h1 className="text-3xl font-bold">Member & Import Management</h1><p className="text-muted-foreground">Manage existing members or bulk import new users.</p></div></div>
                    <Card className="bg-gradient-card shadow-card border-primary/10"><CardHeader><CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" />Site Selection</CardTitle><CardDescription>Choose a site to manage its members or import new ones.</CardDescription></CardHeader><CardContent>{isLoadingSites ? <p>Loading sites...</p> : (<div className="max-w-md"><Select value={selectedSite} onValueChange={(value) => { setSelectedSite(value); setSearchResults([]); setSelectedMembers([]); }} disabled={sites.length === 0}><SelectTrigger><SelectValue placeholder="No sites added yet..." /></SelectTrigger><SelectContent>{sites.map((site) => (site && <SelectItem key={site._id} value={site.siteId}>{site.siteName}</SelectItem>))}</SelectContent></Select></div>)}</CardContent></Card>

                    {/* ★★★ The search and delete UI is added back here ★★★ */}
                    <Card className="bg-gradient-card shadow-card border-primary/10">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Search by name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                                />
                                <Button onClick={handleSearch} disabled={isSearching || !selectedSite}>
                                    <Search className="mr-2 h-4 w-4"/>
                                    {isSearching ? 'Searching...' : 'Search'}
                                </Button>
                            </div>

                            {(isSearching || searchResults.length > 0) && (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[50px]">
                                                    <Checkbox
                                                        checked={searchResults.length > 0 && selectedMembers.length === searchResults.length}
                                                        onCheckedChange={(checked) => {
                                                            const allMembers = checked
                                                                ? searchResults.map(m => ({ memberId: m.id, contactId: m.contactId }))
                                                                : [];
                                                            setSelectedMembers(allMembers);
                                                        }}
                                                    />
                                                </TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isSearching ? (
                                                <TableRow><TableCell colSpan={3} className="text-center h-24">Searching...</TableCell></TableRow>
                                            ) : (
                                                searchResults.map(member => (
                                                    <TableRow key={member.id}>
                                                        <TableCell>
                                                            <Checkbox
                                                                checked={selectedMembers.some(m => m.memberId === member.id)}
                                                                onCheckedChange={(checked) => {
                                                                    setSelectedMembers(prev =>
                                                                        checked
                                                                            ? [...prev, { memberId: member.id, contactId: member.contactId }]
                                                                            : prev.filter(m => m.memberId !== member.id)
                                                                    );
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell>{member.profile?.nickname || 'N/A'}</TableCell>
                                                        <TableCell>{member.loginEmail}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                        {selectedMembers.length > 0 && (
                            <CardFooter>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" disabled={isDeleting}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            {isDeleting ? 'Deleting...' : `Delete (${selectedMembers.length}) Selected`}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the selected {selectedMembers.length} member(s) AND their contact records from the site. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, Delete Members</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardFooter>
                        )}
                    </Card>

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            <Card className="bg-gradient-card shadow-card border-primary/10">
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle>Bulk User Import</CardTitle>
                                            <CardDescription>Enter one email address per line to import new users.</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary">{emailCount} email(s)</Badge>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => setRecipientEmails("")} disabled={recipientEmails === ""}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent><Textarea value={recipientEmails} onChange={(e) => setRecipientEmails(e.target.value)} placeholder="user1@example.com user2@example.com" className="h-48 resize-y font-mono text-sm" /></CardContent>
                            </Card>
                            <div className="space-y-8">
                                <Card className="bg-gradient-card shadow-card border-primary/10"><CardHeader><CardTitle>Import Job Settings</CardTitle><CardDescription>Configure the import job behavior.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="delay">Delay Between Requests (seconds)</Label><div className="relative"><Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="delay" type="number" value={delaySeconds} onChange={(e) => setDelaySeconds(Number(e.target.value))} min="0" className="pl-10" /></div></div></CardContent></Card>
                                <Card className="bg-gradient-card shadow-card border-primary/10"><CardHeader><CardTitle>Custom Welcome Email</CardTitle><CardDescription>This will be the subject of your Triggered Email.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="subject">Email Subject</Label><Input id="subject" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="Welcome aboard!" /></div></CardContent></Card>
                            </div>
                        </div>
                        <Card className="bg-gradient-primary text-primary-foreground shadow-glow mt-8">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div><h3 className="text-xl font-bold">{isSubmitting ? (isPaused ? 'Job Paused' : 'Job in Progress...') : 'Ready to Import?'}</h3><p className="text-primary-foreground/80">{isSubmitting ? 'You can pause, resume, or end the import job at any time.' : 'Start the import job for the selected site.'}</p></div>
                                {!isSubmitting ? (<Button type="submit" disabled={!recipientEmails} className="w-48 bg-white text-primary hover:bg-white/90" size="lg"><PlayCircle className="mr-2 h-5 w-5" />Start Import Job</Button>) : (<div className="flex items-center gap-4"><Button type="button" onClick={handlePauseResume} variant="outline" className="w-48 bg-white/20 hover:bg-white/30" size="lg">{isPaused ? <PlayCircle className="mr-2 h-5 w-5" /> : <PauseCircle className="mr-2 h-5 w-5" />}{isPaused ? 'Resume Job' : 'Pause Job'}</Button><AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="destructive" size="lg"><StopCircle className="mr-2 h-5 w-5" /> End Job</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>End the Import Job?</AlertDialogTitle><AlertDialogDescription>The current import process will be terminated. Any remaining emails will not be processed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleEndJob} className="bg-destructive hover:bg-destructive/90">Yes, End Job</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>)}
                            </CardContent>
                        </Card>
                    </form>

                    {importResults.length > 0 && (
                        <Card className="bg-gradient-card shadow-card border-primary/10">
                            <CardHeader><CardTitle>Import Results</CardTitle>{isSubmitting || progress < 100 ? (<div className="space-y-2 pt-2"><Progress value={progress} className="w-full" /><p className="text-sm text-muted-foreground">{isPaused ? "Job is paused..." : countdown > 0 ? `Next import in ${countdown}s...` : isSubmitting ? `Processing user ${Math.ceil(progress / 100 * emailCount)} of ${emailCount}` : "Job finished."}</p></div>) : (<CardDescription>The import process has finished.</CardDescription>)}</CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead className="w-[120px]">Status</TableHead><TableHead>Email</TableHead><TableHead>Details</TableHead><TableHead className="w-[150px] text-right">Full Response</TableHead></TableRow></TableHeader>
                                    <TableBody>{importResults.map((result, index) => (<TableRow key={index}><TableCell>{result.status === 'SUCCESS' ? (<span className="flex items-center gap-2 text-green-400"><CheckCircle className="h-4 w-4" /> Success</span>) : result.status === 'ERROR' ? (<span className="flex items-center gap-2 text-red-400"><XCircle className="h-4 w-4" /> Error</span>) : (<span className="flex items-center gap-2 text-muted-foreground">... {result.message}</span>)}</TableCell><TableCell className="font-mono text-xs">{result.email}</TableCell><TableCell>{result.status !== 'PENDING' ? result.message : ''}</TableCell><TableCell className="text-right">{result.details && result.status !== 'PENDING' && (<Dialog><DialogTrigger asChild><Button variant="outline" size="sm" className="gap-2"><FileJson className="h-4 w-4" /> View Details</Button></DialogTrigger><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Full Response</DialogTitle></DialogHeader><pre className="mt-2 w-full rounded-md bg-slate-900 p-4 overflow-x-auto"><code className="text-white">{JSON.stringify(result.details, null, 2)}</code></pre><DialogClose asChild><Button type="button" className="mt-4">Close</Button></DialogClose></DialogContent></Dialog>)}</TableCell></TableRow>))}</TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="bg-gradient-card shadow-card border-primary/10">
                        <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2"><Terminal className="h-5 w-5" />Backend Activity Log</CardTitle><CardDescription>Recent events from the backend functions.</CardDescription></div><div className="flex items-center gap-2"><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" disabled={isClearingLogs}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear All Logs?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleClearLogs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isClearingLogs ? 'Clearing...' : 'Yes, Clear Logs'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><Button variant="outline" size="icon" onClick={fetchLogs} disabled={isLoadingLogs}><RefreshCw className={`h-4 w-4 ${isLoadingLogs ? 'animate-spin' : ''}`} /></Button></div></CardHeader>
                        <CardContent><div className="bg-gray-900 text-white font-mono text-xs rounded-lg p-4 h-64 overflow-y-auto">{isLoadingLogs ? <p>Loading logs...</p> : (logs.length === 0 ? <p>No log entries yet.</p> : logs.filter(log => log).map(log => (<div key={log._id} className="flex gap-4"><span className="text-gray-500">{new Date(log._createdDate).toLocaleTimeString()}</span><span className={`${getStatusColor(log.status)} w-20`}>[{log.status}]</span><span className="flex-1">{log.message}</span></div>)))}</div></CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AdminImport;