import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { scrapeLegalSite, searchIndianKanoon, ALLOWED_LEGAL_SITES } from "@/lib/api/legal-data";
import { Globe, Search, FileText, Loader2, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";

interface IngestResult {
  type: "scrape" | "search";
  title: string;
  status: "success" | "error";
  message: string;
}

export function DataIngestionPanel() {
  const { toast } = useToast();
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<IngestResult[]>([]);

  const handleScrape = async (url: string) => {
    setIsLoading(true);
    try {
      const result = await scrapeLegalSite({ url });
      
      if (result.success && result.data) {
        setResults(prev => [{
          type: "scrape",
          title: result.data!.title,
          status: "success",
          message: `Added ${result.data!.chunks_created} chunks to knowledge base`,
        }, ...prev]);
        
        toast({
          title: "Page scraped successfully",
          description: `${result.data.chunks_created} chunks added to knowledge base`,
        });
      } else {
        setResults(prev => [{
          type: "scrape",
          title: url,
          status: "error",
          message: result.error || "Failed to scrape",
        }, ...prev]);
        
        toast({
          title: "Scrape failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to scrape",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setScrapeUrl("");
    }
  };

  const handleSearch = async (ingest: boolean = false) => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await searchIndianKanoon({ 
        query: searchQuery, 
        ingestToKnowledgeBase: ingest 
      });
      
      if (result.success && result.data) {
        if (result.data.message) {
          toast({
            title: "API Not Configured",
            description: result.data.alternative,
          });
        } else if (ingest && result.data.ingested) {
          result.data.ingested.forEach(title => {
        setResults(prev => [{
              type: "search",
              title,
              status: "success",
              message: "Added to knowledge base from Indian Kanoon",
            }, ...prev]);
          });
          
          toast({
            title: "Documents ingested",
            description: `${result.data.ingested.length} documents added to knowledge base`,
          });
        } else {
          toast({
            title: "Search complete",
            description: `Found ${result.data.total_results} results`,
          });
        }
      } else {
        toast({
          title: "Search failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Search failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Data Ingestion
        </CardTitle>
        <CardDescription>
          Import legal data from official government sources
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="scrape" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scrape" className="gap-2">
              <Globe className="h-4 w-4" />
              Web Scrape
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Indian Kanoon
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scrape" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://indiacode.nic.in/..."
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                disabled={isLoading}
              />
              <Button 
                onClick={() => handleScrape(scrapeUrl)}
                disabled={isLoading || !scrapeUrl.trim()}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scrape"}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">
                Allowed official sources:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALLOWED_LEGAL_SITES.map((site) => (
                  <Badge 
                    key={site.domain} 
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => setScrapeUrl(`https://${site.domain}`)}
                  >
                    {site.name}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="search" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search Acts, Sections, Case Laws..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isLoading}
              />
              <Button 
                onClick={() => handleSearch(true)}
                disabled={isLoading || !searchQuery.trim()}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search & Add"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Search Indian Kanoon and add relevant documents to your knowledge base
            </p>
          </TabsContent>
        </Tabs>

        {results.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Recent ingestions:
            </p>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {results.slice(0, 10).map((result, i) => (
                  <div 
                    key={i}
                    className="flex items-start gap-2 text-xs p-2 rounded-md bg-muted/30"
                  >
                    {result.status === "success" ? (
                      <CheckCircle className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{result.title}</p>
                      <p className="text-muted-foreground">{result.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
