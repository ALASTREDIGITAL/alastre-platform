"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileArchive,
  FileText,
  Fingerprint,
  Globe,
  ImagePlus,
  Images,
  Info,
  LoaderCircle,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import * as exifr from "exifr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { postPlatform } from "@/lib/platform-api";
import { isClientSummaryArray, type ClientSummary } from "./clients-module";
import {
  defaultGeotagMetadata,
  extractClientDnaMetadata,
  fileToJpegDataUrl,
  injectExifMetadata,
  formatSexagesimal,
  createZipUint8Array,
  dataUrlToUint8Array,
  generateClientDossierText,
  getHyphenatedImagePrefix,
  getUnderscoreImagePrefix,
  type GeotagMetadata,
} from "@/lib/geotag-domain";

type PhotoItem = {
  id: string;
  file: File;
  url: string;
  metadata: GeotagMetadata;
  selected: boolean;
};

const DEFAULT_LAT = -23.5505;
const DEFAULT_LNG = -46.6333;

export function ImageGeotagModule({
  clientId,
  onSelectClient,
}: {
  clientId: string;
  onSelectClient: (id: string) => void;
}) {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"location" | "description" | "keywords" | "contact">("location");
  const [formMeta, setFormMeta] = useState<GeotagMetadata>(defaultGeotagMetadata());
  const [newKeyword, setNewKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>("");

  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PhotoItem[]>([]);

  const activePhoto = photos.find((p) => p.id === activeId) ?? photos[0] ?? null;
  const selectedPhotos = photos.filter((p) => p.selected);
  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  const loadClients = useCallback(async () => {
    try {
      setClients(await postPlatform({ action: "clients" }, isClientSummaryArray));
    } catch {
      setClients([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadClients(), 0);
    return () => window.clearTimeout(timer);
  }, [loadClients]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  // When active photo changes, load its metadata into formMeta
  useEffect(() => {
    if (activePhoto) {
      setFormMeta({ ...activePhoto.metadata });
    }
  }, [activePhoto?.id]);

  // Handle file addition with EXIF extraction
  async function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return toast.error("Selecione arquivos de imagem válidos.");

    const additions = await Promise.all(
      files.map(async (file): Promise<PhotoItem> => {
        let latitude: number | null = null;
        let longitude: number | null = null;
        try {
          const gps = await exifr.gps(file);
          if (typeof gps?.latitude === "number") latitude = gps.latitude;
          if (typeof gps?.longitude === "number") longitude = gps.longitude;
        } catch {
          // Arquivo sem EXIF legível
        }

        const initialMeta: GeotagMetadata = selectedClient
          ? extractClientDnaMetadata(selectedClient)
          : defaultGeotagMetadata();

        if (latitude !== null && longitude !== null) {
          initialMeta.latitude = latitude;
          initialMeta.longitude = longitude;
        }

        return {
          id: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
          metadata: initialMeta,
          selected: false,
        };
      })
    );

    setPhotos((current) => [...current, ...additions]);
    if (!activeId && additions[0]) {
      setActiveId(additions[0].id);
      setFormMeta({ ...additions[0].metadata });
    }
    toast.success(`${additions.length} imagem(ns) adicionada(s).`);
  }

  // Auto-fill from Client DNA with optional geocoding
  async function autoFillFromClientDna() {
    if (!selectedClient) {
      return toast.error("Selecione um cliente no topo da página primeiro.");
    }

    const dnaMeta = extractClientDnaMetadata(selectedClient);

    // If client DNA lacks coordinates, attempt automatic geocoding
    if (dnaMeta.latitude === null && (dnaMeta.address || dnaMeta.city)) {
      setSearching(true);
      const query = [dnaMeta.address, dnaMeta.neighborhood, dnaMeta.city, dnaMeta.state, "Brasil"]
        .filter(Boolean)
        .join(", ");
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
          { headers: { "Accept-Language": "pt-BR" } }
        );
        const [result] = await res.json();
        if (result?.lat && result?.lon) {
          dnaMeta.latitude = Number(result.lat);
          dnaMeta.longitude = Number(result.lon);
          toast.success(`Coordenadas geocodificadas para ${dnaMeta.city}.`);
        }
      } catch {
        // Fallback mantém latitude vazia para ajuste manual
      } finally {
        setSearching(false);
      }
    }

    setFormMeta(dnaMeta);
    toast.success(`Metadados carregados do DNA de "${selectedClient.name}".`);
  }

  // Apply current formMeta to active or selected photos
  function applyToSelectedOrActive() {
    const targets = selectedPhotos.length ? selectedPhotos : activePhoto ? [activePhoto] : [];
    if (!targets.length) return toast.error("Selecione ao menos uma imagem.");

    const targetIds = new Set(targets.map((p) => p.id));
    setPhotos((current) =>
      current.map((p) => (targetIds.has(p.id) ? { ...p, metadata: { ...formMeta } } : p))
    );
    toast.success(`Metadados aplicados a ${targets.length} imagem(ns).`);
  }

  // Apply DNA to ALL loaded photos at once
  async function applyDnaToAllPhotos() {
    if (!selectedClient) {
      return toast.error("Selecione um cliente primeiro.");
    }
    if (!photos.length) {
      return toast.error("Adicione ao menos uma imagem para aplicar o DNA.");
    }

    const dnaMeta = extractClientDnaMetadata(selectedClient);

    if (dnaMeta.latitude === null && (dnaMeta.address || dnaMeta.city)) {
      setSearching(true);
      const query = [dnaMeta.address, dnaMeta.neighborhood, dnaMeta.city, dnaMeta.state, "Brasil"]
        .filter(Boolean)
        .join(", ");
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
          { headers: { "Accept-Language": "pt-BR" } }
        );
        const [result] = await res.json();
        if (result?.lat && result?.lon) {
          dnaMeta.latitude = Number(result.lat);
          dnaMeta.longitude = Number(result.lon);
        }
      } catch {
        // Geocode error ignored
      } finally {
        setSearching(false);
      }
    }

    setFormMeta(dnaMeta);
    setPhotos((current) => current.map((p) => ({ ...p, metadata: { ...dnaMeta } })));
    toast.success(`DNA de "${selectedClient.name}" aplicado a todas as ${photos.length} fotos!`);
  }

  // Search address via OpenStreetMap Nominatim
  async function searchAddress() {
    const query = [formMeta.address, formMeta.city, formMeta.state, formMeta.country]
      .filter(Boolean)
      .join(", ");
    if (!query.trim()) return toast.error("Preencha ao menos cidade ou endereço.");

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": "pt-BR" } }
      );
      const [result] = await response.json();
      if (!result) return toast.error("Endereço não localizado.");
      setFormMeta((cur) => ({
        ...cur,
        latitude: Number(result.lat),
        longitude: Number(result.lon),
      }));
      toast.success("Coordenadas atualizadas com sucesso!");
    } catch {
      toast.error("Erro ao buscar coordenadas na web.");
    } finally {
      setSearching(false);
    }
  }

  // Keyword management
  function addKeyword() {
    const val = newKeyword.trim();
    if (!val) return;
    if (formMeta.keywords.includes(val)) return toast.info("Palavra-chave já adicionada.");
    setFormMeta((cur) => ({ ...cur, keywords: [...cur.keywords, val] }));
    setNewKeyword("");
  }

  function removeKeyword(keyword: string) {
    setFormMeta((cur) => ({ ...cur, keywords: cur.keywords.filter((k) => k !== keyword) }));
  }

  // Copy ClickUp / Drive client dossier to clipboard
  async function copyClickupDossier() {
    if (!selectedClient) return toast.error("Selecione um cliente no topo primeiro.");
    const text = generateClientDossierText(selectedClient, formMeta);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Ficha técnica copiada! Pronta para colar no ClickUp e salvar no Drive.");
    } catch {
      toast.error("Não foi possível copiar para a área de transferência.");
    }
  }

  // Export photos (Individual download if 1, ZIP archive if multiple)
  async function exportPhotos() {
    const targets = selectedPhotos.length ? selectedPhotos : photos;
    if (!targets.length) return toast.error("Nenhuma foto disponível para exportar.");

    setExporting(true);
    setExportProgress("Preparando exportação...");

    try {
      const clientName = selectedClient?.name || formMeta.artist || "imagem";
      const bServices = selectedClient?.dna?.business_data?.services;
      const servicesOrKeywords = Array.isArray(bServices)
        ? (bServices as string[])
        : formMeta.keywords;
      const filePrefix = getUnderscoreImagePrefix(clientName, servicesOrKeywords);

      if (targets.length === 1) {
        const photo = targets[0];
        setExportProgress("Processando metadados EXIF...");
        const jpegDataUrl = await fileToJpegDataUrl(photo.file);
        const taggedDataUrl = injectExifMetadata(jpegDataUrl, photo.metadata);

        const cleanName = `${filePrefix} (1).jpg`;
        const link = document.createElement("a");
        link.href = taggedDataUrl;
        link.download = cleanName;
        link.click();
        toast.success(`Foto "${cleanName}" exportada com metadados!`);
      } else {
        // Multiple photos: Package into ZIP
        const entries: Array<{ name: string; data: Uint8Array }> = [];
        for (let i = 0; i < targets.length; i++) {
          const photo = targets[i];
          setExportProgress(`Processando foto ${i + 1} de ${targets.length}...`);
          const jpegDataUrl = await fileToJpegDataUrl(photo.file);
          const taggedDataUrl = injectExifMetadata(jpegDataUrl, photo.metadata);
          const uint8Data = dataUrlToUint8Array(taggedDataUrl);
          const cleanName = `${filePrefix} (${i + 1}).jpg`;
          entries.push({ name: cleanName, data: uint8Data });
        }

        // Anexa o documento oficial do cliente para ClickUp e Drive
        if (selectedClient) {
          setExportProgress("Gerando documento ClickUp / Drive...");
          const dossierText = generateClientDossierText(selectedClient, formMeta);
          const dossierBytes = new TextEncoder().encode(dossierText);
          entries.push({
            name: "METADADOS-CLICKUP-E-DRIVE.txt",
            data: dossierBytes,
          });
        }

        setExportProgress("Empacotando arquivo .ZIP...");
        const zipBytes = createZipUint8Array(entries);
        const zipBlob = new Blob([zipBytes.buffer as ArrayBuffer], { type: "application/zip" });
        const zipUrl = URL.createObjectURL(zipBlob);

        const slug = selectedClient?.slug || "alastre";
        const zipName = `${slug}-fotos-geotag.zip`;
        const link = document.createElement("a");
        link.href = zipUrl;
        link.download = zipName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(zipUrl), 5000);

        toast.success(
          `${targets.length} fotos + documento de metadados empacotados em "${zipName}"!`
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar metadados EXIF e exportar.");
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  }

  // Map URL for OSM iframe
  const mapUrl = useMemo(() => {
    const lat = formMeta.latitude ?? DEFAULT_LAT;
    const lng = formMeta.longitude ?? DEFAULT_LNG;
    const delta = 0.015;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;
  }, [formMeta.latitude, formMeta.longitude]);

  return (
    <div className="space-y-4">
      {/* Header com ações de topo */}
      <PageHeader
        eyebrow={
          <>
            <Images /> CONTEÚDO LOCAL · GEOTAG
          </>
        }
        title="Geotag & Metadados de Fotos (GeoSetter)"
        description="Geotagging, IPTC e tags de SEO Local aplicados em lote diretamente pelo DNA do cliente."
        helpKey="clients.overview"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && void addFiles(e.target.files)}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> Adicionar Fotos
            </Button>
            <Button
              variant="secondary"
              onClick={() => void autoFillFromClientDna()}
              disabled={!selectedClient}
            >
              <Sparkles className="h-4 w-4 text-amber-500" /> Preencher com DNA
            </Button>
            <Button
              variant="outline"
              onClick={() => void copyClickupDossier()}
              disabled={!selectedClient}
              title="Copiar modelo de ficha técnica para colar no ClickUp e salvar na pasta do cliente"
            >
              <Copy className="h-4 w-4" /> Copiar Ficha ClickUp
            </Button>
            <Button
              variant="default"
              onClick={() => void applyDnaToAllPhotos()}
              disabled={!selectedClient || !photos.length}
            >
              <Zap className="h-4 w-4" /> Aplicar a Todas
            </Button>
            <Button
              variant="default"
              onClick={() => void exportPhotos()}
              disabled={!photos.length || exporting}
            >
              {exporting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : photos.length > 1 ? (
                <FileArchive className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {photos.length > 1 ? "Exportar Lote (.ZIP)" : "Exportar Foto"}
            </Button>
          </div>
        }
      />

      {/* Barra de Seleção de Cliente e Estatísticas */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="geotag-client" className="font-semibold text-sm">
            Cliente Ativo:
          </Label>
          <select
            id="geotag-client"
            className="h-9 min-w-64 rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-primary"
            value={clients.some((c) => c.id === clientId) ? clientId : ""}
            onChange={(e) => onSelectClient(e.target.value)}
          >
            <option value="">Selecione o cliente...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {selectedClient?.dna ? (
            <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <Fingerprint className="h-3 w-3" /> DNA Disponível
            </Badge>
          ) : selectedClient ? (
            <Badge variant="outline" className="text-muted-foreground">
              Sem DNA cadastrado
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{photos.length} foto(s) carregada(s)</span>
          <span>·</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {photos.filter((p) => p.metadata.latitude !== null).length} com GPS
          </span>
          <span>·</span>
          <span>{selectedPhotos.length} selecionada(s)</span>
          {exportProgress && (
            <span className="flex items-center gap-1 font-semibold text-primary">
              <LoaderCircle className="h-3 w-3 animate-spin" /> {exportProgress}
            </span>
          )}
        </div>
      </div>

      {/* Área Principal: Quando vazia mostra Dropzone, quando cheia mostra Interface GeoSetter */}
      {!photos.length ? (
        <button
          className="flex min-h-[500px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card p-10 text-center transition-colors hover:border-primary focus:outline-none"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void addFiles(e.dataTransfer.files);
          }}
        >
          <UploadCloud className="mb-4 h-14 w-14 text-primary animate-pulse" />
          <strong className="text-lg font-semibold">Arraste suas fotos para o Geotag da Alastre</strong>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Compatível com fotos em qualquer formato (JPG, PNG, WebP). Os dados do DNA (endereço, coordenadas, serviços,
            tags de SEO local e autor) são gravados diretamente no cabeçalho EXIF/IPTC.
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> Selecionar arquivos do computador
            </Button>
          </div>
        </button>
      ) : (
        <div className="grid min-h-[640px] grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Coluna 1: Grade de Fotos / Lote (Estilo GeoSetter) */}
          <div className="flex flex-col rounded-2xl border bg-card shadow-xs lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between border-b p-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPhotos((cur) =>
                      cur.map((p) => ({ ...p, selected: cur.some((item) => !item.selected) }))
                    )
                  }
                >
                  {photos.every((p) => p.selected) ? "Desmarcar Todas" : "Selecionar Todas"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={!selectedPhotos.length && !activePhoto}
                  onClick={() => {
                    const idsToRemove = new Set(
                      (selectedPhotos.length ? selectedPhotos : activePhoto ? [activePhoto] : []).map(
                        (p) => p.id
                      )
                    );
                    setPhotos((cur) => cur.filter((p) => !idsToRemove.has(p.id)));
                    setActiveId(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Remover
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                Clique na foto para editar · Marque caixas para ações em lote
              </span>
            </div>

            {/* Grid de miniaturas */}
            <div className="grid max-h-[460px] flex-1 grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((photo) => {
                const isActive = activePhoto?.id === photo.id;
                const hasGps = photo.metadata.latitude !== null && photo.metadata.longitude !== null;
                const hasTitle = Boolean(photo.metadata.title);

                return (
                  <div
                    key={photo.id}
                    onClick={() => setActiveId(photo.id)}
                    className={cn(
                      "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-background p-2 transition-all hover:border-primary/50",
                      isActive && "border-primary ring-2 ring-primary/20 bg-primary/5"
                    )}
                  >
                    <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-muted">
                      <img
                        src={photo.url}
                        alt={photo.file.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      {/* Checkbox de seleção */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotos((cur) =>
                            cur.map((p) => (p.id === photo.id ? { ...p, selected: !p.selected } : p))
                          );
                        }}
                        className={cn(
                          "absolute top-2 left-2 grid h-5 w-5 place-items-center rounded border bg-background/90 shadow-sm transition-colors",
                          photo.selected && "border-primary bg-primary text-primary-foreground"
                        )}
                      >
                        {photo.selected && <Check className="h-3 w-3 stroke-[3]" />}
                      </button>

                      {/* Status Badges sobrepostos */}
                      <div className="absolute bottom-1 right-1 flex gap-1">
                        <span
                          className={cn(
                            "rounded px-1 text-[10px] font-bold uppercase shadow-xs",
                            hasGps ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                          )}
                        >
                          {hasGps ? "GPS" : "S/ GPS"}
                        </span>
                        {hasTitle && (
                          <span className="rounded bg-sky-600 px-1 text-[10px] font-bold uppercase text-white shadow-xs">
                            SEO
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 min-w-0">
                      <p className="truncate text-xs font-medium" title={photo.file.name}>
                        {photo.file.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {(photo.file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Painel Inferior: Pré-visualização da Imagem Ativa (GeoSetter Preview) */}
            {activePhoto && (
              <div className="border-t bg-muted/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Pré-visualização: {activePhoto.file.name}
                  </span>
                  <div className="flex gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">
                      GPS: {formatSexagesimal(activePhoto.metadata.latitude, "lat")},{" "}
                      {formatSexagesimal(activePhoto.metadata.longitude, "lng")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-28 w-36 shrink-0 overflow-hidden rounded-lg border bg-black/5">
                    <img
                      src={activePhoto.url}
                      alt={activePhoto.file.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1 text-xs">
                    <p className="truncate">
                      <b className="text-muted-foreground">Título SEO:</b>{" "}
                      {activePhoto.metadata.title || "—"}
                    </p>
                    <p className="line-clamp-2">
                      <b className="text-muted-foreground">Descrição:</b>{" "}
                      {activePhoto.metadata.description || "—"}
                    </p>
                    <p className="truncate">
                      <b className="text-muted-foreground">Tags:</b>{" "}
                      {activePhoto.metadata.keywords.join(", ") || "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Coluna 2: Painel "Editar Dados" (Abas estilo GeoSetter) */}
          <div className="flex flex-col rounded-2xl border bg-card shadow-xs lg:col-span-5">
            <div className="border-b p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Editar Dados da Foto</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedPhotos.length
                      ? `${selectedPhotos.length} fotos selecionadas para edição conjunta`
                      : activePhoto
                      ? `Editando dados de "${activePhoto.file.name}"`
                      : "Selecione uma foto"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={autoFillFromClientDna} disabled={!selectedClient}>
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Puxar DNA
                </Button>
              </div>

              {/* Abas Estilo GeoSetter */}
              <div className="mt-3 flex gap-1 border-b border-muted">
                <button
                  type="button"
                  onClick={() => setActiveTab("location")}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition-colors",
                    activeTab === "location"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MapPin className="h-3.5 w-3.5" /> Localização
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("description")}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition-colors",
                    activeTab === "description"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Info className="h-3.5 w-3.5" /> Descrição
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("keywords")}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition-colors",
                    activeTab === "keywords"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Tag className="h-3.5 w-3.5" /> Palavras-chave
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("contact")}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition-colors",
                    activeTab === "contact"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Phone className="h-3.5 w-3.5" /> Contato
                </button>
              </div>
            </div>

            {/* Conteúdo das Abas */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[500px]">
              {/* ABA 1: Localização & GPS */}
              {activeTab === "location" && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Latitude (Decimal)</Label>
                      <Input
                        type="number"
                        step="any"
                        value={formMeta.latitude ?? ""}
                        placeholder="-23.6821"
                        onChange={(e) =>
                          setFormMeta((cur) => ({
                            ...cur,
                            latitude: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                      />
                      <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                        {formatSexagesimal(formMeta.latitude, "lat")}
                      </span>
                    </div>
                    <div>
                      <Label className="text-xs">Longitude (Decimal)</Label>
                      <Input
                        type="number"
                        step="any"
                        value={formMeta.longitude ?? ""}
                        placeholder="-46.6123"
                        onChange={(e) =>
                          setFormMeta((cur) => ({
                            ...cur,
                            longitude: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                      />
                      <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                        {formatSexagesimal(formMeta.longitude, "lng")}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Lugar / Endereço</Label>
                    <Input
                      value={formMeta.address}
                      placeholder="Ex: R. dos Pessegueiros, 522"
                      onChange={(e) => setFormMeta((cur) => ({ ...cur, address: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Bairro</Label>
                      <Input
                        value={formMeta.neighborhood}
                        placeholder="Ex: Taboão"
                        onChange={(e) =>
                          setFormMeta((cur) => ({ ...cur, neighborhood: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cidade</Label>
                      <Input
                        value={formMeta.city}
                        placeholder="Ex: Diadema"
                        onChange={(e) => setFormMeta((cur) => ({ ...cur, city: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Estado</Label>
                      <Input
                        value={formMeta.state}
                        placeholder="SP"
                        onChange={(e) => setFormMeta((cur) => ({ ...cur, state: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">País</Label>
                      <Input
                        value={formMeta.country}
                        onChange={(e) => setFormMeta((cur) => ({ ...cur, country: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Altitude (m)</Label>
                      <Input
                        type="number"
                        value={formMeta.altitude ?? 0}
                        onChange={(e) =>
                          setFormMeta((cur) => ({ ...cur, altitude: Number(e.target.value) }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={searchAddress}
                      disabled={searching}
                    >
                      {searching ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                      Obter Coordenadas do Endereço
                    </Button>
                  </div>

                  {/* Visualizador de mapa integrado */}
                  <div className="mt-2 h-44 w-full overflow-hidden rounded-xl border bg-muted">
                    <iframe
                      title="Mapa de visualização"
                      src={mapUrl}
                      className="h-full w-full border-0"
                    />
                  </div>
                </div>
              )}

              {/* ABA 2: Descrição / Título / Créditos */}
              {activeTab === "description" && (
                <div className="space-y-3 text-xs">
                  <div>
                    <Label className="text-xs">Título da Imagem (XPTitle / Objeto)</Label>
                    <Input
                      value={formMeta.title}
                      placeholder="Ex: Vitrificação de Pintura em Diadema - Pinheiro Estética"
                      onChange={(e) => setFormMeta((cur) => ({ ...cur, title: e.target.value }))}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Gravado nas tags EXIF XPTitle e DocumentName (usado por buscadores e Windows Explorer).
                    </span>
                  </div>

                  <div>
                    <Label className="text-xs">Descrição / Legenda (ImageDescription)</Label>
                    <Textarea
                      rows={3}
                      value={formMeta.description}
                      placeholder="Breve descrição comercial com serviços e área de atendimento..."
                      onChange={(e) =>
                        setFormMeta((cur) => ({ ...cur, description: e.target.value }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Artista / Fotógrafo</Label>
                      <Input
                        value={formMeta.artist}
                        placeholder="Nome da Empresa ou Fotógrafo"
                        onChange={(e) => setFormMeta((cur) => ({ ...cur, artist: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Créditos</Label>
                      <Input
                        value={formMeta.credit}
                        onChange={(e) => setFormMeta((cur) => ({ ...cur, credit: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Direitos Autorais (Copyright)</Label>
                    <Input
                      value={formMeta.copyright}
                      onChange={(e) => setFormMeta((cur) => ({ ...cur, copyright: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* ABA 3: Palavras-chave / Tags SEO */}
              {activeTab === "keywords" && (
                <div className="space-y-3 text-xs">
                  <div>
                    <Label className="text-xs">Adicionar Palavra-chave</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={newKeyword}
                        placeholder="Ex: polimento automotivo diadema"
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                      />
                      <Button size="sm" onClick={addKeyword}>
                        Adicionar
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between pb-1">
                      <Label className="text-xs">Tags Gravadas ({formMeta.keywords.length})</Label>
                      {formMeta.keywords.length > 0 && (
                        <button
                          type="button"
                          className="text-[10px] text-destructive hover:underline"
                          onClick={() => setFormMeta((cur) => ({ ...cur, keywords: [] }))}
                        >
                          Limpar todas
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 rounded-xl border bg-background p-2.5 min-h-24 max-h-48 overflow-y-auto">
                      {formMeta.keywords.length ? (
                        formMeta.keywords.map((kw) => (
                          <Badge
                            key={kw}
                            variant="secondary"
                            className="gap-1 py-0.5 text-xs font-normal"
                          >
                            {kw}
                            <button
                              type="button"
                              onClick={() => removeKeyword(kw)}
                              className="rounded-full hover:bg-muted"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground p-2">
                          Nenhuma palavra-chave configurada. Clique em &quot;Puxar DNA&quot; para preencher automaticamente com os serviços e palavras-chave da empresa.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 4: Contato & Links */}
              {activeTab === "contact" && (
                <div className="space-y-3 text-xs">
                  <div>
                    <Label className="text-xs">Telefone / WhatsApp</Label>
                    <Input
                      value={formMeta.phone}
                      placeholder="(11) 98765-4321"
                      onChange={(e) => setFormMeta((cur) => ({ ...cur, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Website</Label>
                    <Input
                      value={formMeta.website}
                      placeholder="https://suaempresa.com.br"
                      onChange={(e) => setFormMeta((cur) => ({ ...cur, website: e.target.value }))}
                    />
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3 text-muted-foreground">
                    <p className="text-[11px] leading-relaxed">
                      Estes dados comerciais são vinculados à descrição da imagem e nos metadados de autoria para reforçar a consistência NAP (Name, Address, Phone) no Google e no Google Maps.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé de Ações do Painel */}
            <div className="border-t p-3 space-y-2 bg-muted/20">
              <Button className="w-full" onClick={applyToSelectedOrActive}>
                <Check className="h-4 w-4" />
                {selectedPhotos.length
                  ? `Aplicar às ${selectedPhotos.length} selecionadas`
                  : "Aplicar à foto ativa"}
              </Button>
              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={() => void applyDnaToAllPhotos()}
                disabled={!selectedClient}
              >
                <Zap className="h-3.5 w-3.5 text-primary" />
                Aplicar DNA a Todas as {photos.length} Fotos
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
