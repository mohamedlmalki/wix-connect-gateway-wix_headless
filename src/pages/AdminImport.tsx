import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPlus, PlayCircle, Building, Trash2, Search, KeyRound, CheckCircle, XCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

import { getWixClient } from "../wixClient";
import { managedSites } from "../sites.config";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface MemberSelection {
    memberId: string;
    contactId: string;
}

const generatePassword = (length = 12) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * n));
    }
    return password;
};

const AdminImport = () => {
    const [selectedSiteClientId, setSelectedSiteClientId] = useState<string>(managedSites[0]?.clientId || "");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<MemberSelection[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [recipientEmails, setRecipientEmails] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importResults, setImportResults] = useState<any[]>([]);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        setSearchResults([]);
        setSelectedMembers([]);
    }, [selectedSiteClientId]);

    const handleSearch = async () => {
        if (!selectedSiteClientId) return;
        setIsSearching(true);
        setSearchResults([]);
        setSelectedMembers([]);
        try {
            const wixClient = await getWixClient(selectedSiteClientId);
            const response = await wixClient.members.queryMembers({
                query: { filter: { "loginEmail": { "$contains": searchQuery } } }
            });
            setSearchResults(response.members || []);
            toast.success(`Search found ${response.members?.length || 0} member(s).`);
        } catch (error: any) {
            toast.error("Search Failed", { description: error.message });
        } finally {
            setIsSearching(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedMembers.length === 0 || !selectedSiteClientId) return;
        setIsDeleting(true);
        try {
            const wixClient = await getWixClient(selectedSiteClientId);
            const memberIds = selectedMembers.map(m => m.memberId);
            const contactIds = selectedMembers.map(m => m.contactId);
            
            await wixClient.members.bulkDeleteMembers({ memberIds });
            toast.info("Members deleted, pausing before deleting contacts...");
            await sleep(5000);

            let successCount = 0;
            for (const contactId of contactIds) {
                await wixClient.contacts.deleteContact(contactId);
                successCount++;
            }
            toast.success(`Successfully deleted ${memberIds.length} member(s) and ${successCount} contact(s).`);
        } catch (error: any) {
            toast.error("Deletion Failed", { description: error.message });
        } finally {
            setIsDeleting(false);
            setSelectedMembers([]);
            await handleSearch();
        }
    };
    
    const handleGeneratePasswords = () => {
        const emails = recipientEmails.split(/[,\s\n]+/).map(email => email.trim()).filter(email => email.includes('@') && !email.includes(':'));
        if (emails.length === 0) {
            toast.info("No valid emails found to generate passwords for.");
            return;
        }
        const usersWithPasswords = emails.map(email => `${email}:${generatePassword()}`).join('\n');
        setRecipientEmails(usersWithPasswords);
        toast.success(`Generated passwords for ${emails.length} user(s).`);
    };

    const handleBulkImport = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedSiteClientId) {
            toast.error("Please select a site before starting the import.");
            return;
        }

        const usersToImport = recipientEmails.split(/[,\s\n]+/).map(line => {
            const parts = line.split(':');
            return { email: parts[0]?.trim(), password: parts[1]?.trim() };
        }).filter(user => user.email && user.password);

        if (usersToImport.length === 0) {
            toast.warning("No users with passwords to import.");
            return;
        }

        setIsSubmitting(true);
        setProgress(0);
        setImportResults([]);
        toast.info(`Starting import for ${usersToImport.length} user(s)...`);

        try {
            const wixClient = await getWixClient(selectedSiteClientId);
            const results: any[] = [];

            for (let i = 0; i < usersToImport.length; i++) {
                const user = usersToImport[i];
                try {
                    await wixClient.auth.register(user.email, user.password);
                    results.push({ email: user.email, status: 'SUCCESS', message: 'Member created successfully.' });
                } catch (error: any) {
                    // ★★★ THIS IS THE FIX ★★★
                    // This new code safely checks for the error message and prevents the crash.
                    let errorMessage = "An unknown error occurred.";
                    if (error?.details?.applicationError?.code === 'MEMBER_ALREADY_EXISTS') {
                        errorMessage = 'Member already exists.';
                    } else if (error && error.message) {
                        errorMessage = error.message;
                    }
                    results.push({ email: user.email, status: 'ERROR', message: errorMessage });
                }
                setImportResults([...results]);
                setProgress(((i + 1) / usersToImport.length) * 100);
            }
            toast.success("Bulk import process finished.");
        } catch (error: any) {
            toast.error("Import Failed", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-subtle">
            <Navbar />
            <div className="container mx-auto px-4 pt-24 pb-12">
                <div className="max-w-5xl mx-auto space-y-8">
                    <div className="flex items-center gap-4 animate-fade-in">
                        <UserPlus className="h-10 w-10 text-primary" />
                        <div>
                            <h1 className="text-3xl font-bold">Member Management & Import</h1>
                            <p className="text-muted-foreground">Manage or import members across your Wix Headless sites.</p>
                        </div>
                    </div>
                    
                    <Card className="bg-gradient-card shadow-card border-primary/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" />Site Selection</CardTitle>
                            <CardDescription>Choose a site to manage or import members into.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="max-w-md">
                                <Select value={selectedSiteClientId} onValueChange={setSelectedSiteClientId}>
                                    <SelectTrigger><SelectValue placeholder="Select a site..." /></SelectTrigger>
                                    <SelectContent>
                                        {managedSites.map((site) => (
                                            <SelectItem key={site.clientId} value={site.clientId}>
                                                {site.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedSiteClientId && (
                                    <div className="mt-4 p-3 bg-muted rounded-md">
                                        <p className="text-xs text-muted-foreground">Connected to Client ID:</p>
                                        <p className="text-sm font-mono break-all">{selectedSiteClientId}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-card shadow-card border-primary/10">
                        <CardHeader>
                            <CardTitle>Manage Existing Members</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Search by email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                                />
                                <Button onClick={handleSearch} disabled={isSearching || !selectedSiteClientId}>
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
                                                                ? searchResults.map(m => ({ memberId: m.id!, contactId: m.contactId! }))
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
                                                                            ? [...prev, { memberId: member.id!, contactId: m.contactId! }]
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
                                                This will permanently delete the selected {selectedMembers.length} member(s) and their contact records. This action cannot be undone.
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

                    <form onSubmit={handleBulkImport}>
                        <Card className="bg-gradient-card shadow-card border-primary/10">
                            <CardHeader>
                                <CardTitle>Bulk Member Import</CardTitle>
                                <CardDescription>
                                    Enter one email per line, generate passwords, then start the import.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    value={recipientEmails}
                                    onChange={(e) => setRecipientEmails(e.target.value)}
                                    placeholder="user1@example.com&#x0a;user2@example.com"
                                    className="h-48 resize-y font-mono text-sm"
                                />
                            </CardContent>
                            <CardFooter className="justify-between">
                                <Button type="button" variant="outline" onClick={handleGeneratePasswords}>
                                    <KeyRound className="mr-2 h-4 w-4" />
                                    Generate Passwords
                                </Button>
                                <Button type="submit" disabled={isSubmitting || !selectedSiteClientId}>
                                    <PlayCircle className="mr-2 h-4 w-4" />
                                    {isSubmitting ? `Importing... ${Math.round(progress)}%` : 'Start Import Job'}
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>

                    {importResults.length > 0 && (
                        <Card className="bg-gradient-card shadow-card border-primary/10">
                            <CardHeader>
                                <CardTitle>Import Results</CardTitle>
                                <Progress value={progress} className="mt-2" />
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {importResults.map((result, index) => (
                                            <TableRow key={index}>
                                                <TableCell>
                                                    {result.status === 'SUCCESS' ? (
                                                        <span className="flex items-center gap-2 text-green-400"><CheckCircle className="h-4 w-4" /> Success</span>
                                                    ) : (
                                                        <span className="flex items-center gap-2 text-red-400"><XCircle className="h-4 w-4" /> Error</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{result.email}</TableCell>
                                                <TableCell>{result.message}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminImport;