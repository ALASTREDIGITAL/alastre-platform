# Graph Report - ALASTRE-PLATFORM  (2026-09-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1347 nodes · 2643 edges · 91 communities (75 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3405d2f9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cn
- ConnectionHubRepository
- sidebar.tsx
- local-seo-operations.tsx
- alastre-google-ads-bridge/index.ts
- utils.ts
- react
- combobox.tsx
- package.json
- dependencies
- class-variance-authority
- tracking-module.tsx
- google-adapter.ts
- isRecord
- 20260909212000_tracking_provisioning_domain.sql
- command.tsx
- 20260912185933_local_seo_security_hardening.sql
- local-seo-module.tsx
- item.tsx
- dropdown-menu.tsx
- devDependencies
- public.tracking_execution_runs
- compilerOptions
- 20260912190349_connection_hub_foundation.sql
- app-shell.tsx
- menubar.tsx
- connection-hub-domain.ts
- local-seo-data.ts
- public.tracking_resource_candidates
- postPlatform
- connections/route.ts
- context-menu.tsx
- 20260913042436_local_seo_v2_foundation.sql
- service.ts
- skills-module.tsx
- carousel.tsx
- 20260904122512_marco_1_foundation.sql
- 20260908162515_security_stabilization.sql
- public.tracking_candidate_artifacts
- foundation.sql
- TrackingModule
- local-score.tsx
- chart.tsx
- field.tsx
- alastre-gtm-service/index.ts
- 20260912185228_local_seo_operations.sql
- layout.tsx
- form.tsx
- 20260910193000_tracking_complete_lifecycle.sql
- connections-module.tsx
- attachment.tsx
- drawer.tsx
- alastre-ga4-service/index.ts
- public.ai_usage_events
- 20260909212800_tracking_foreign_key_indexes.sql
- public.platform_build_tracking_change_plan
- 20260904151205_marco_1_client_dna_agent_workspace.sql
- operations-module.tsx
- page-header.tsx
- navigation-menu.tsx
- 20260904130054_marco_1_google_ads_drafts_approvals.sql
- chatgpt-auth.ts
- popover.tsx
- local-seo-types.ts
- scripts
- 20260904151906_marco_1_agent_foreign_key_indexes.sql
- bubble.tsx
- public.client_services
- input-otp.tsx
- tabs.tsx
- public.platform_record_conversation_v2
- resizable.tsx
- server-config.ts
- 20260908211946_ai_gateway_foreign_key_indexes.sql
- 20260910131500_tracking_candidate_foreign_key_indexes.sql
- 20260910174500_tracking_live_preflight.sql
- 20260910194500_tracking_missing_stack_creation.sql
- google-ads/route.ts
- platform/route.ts
- integrations_client_id_idx
- public.platform_record_tracking_discovery
- tracking_execution_runs_agency_idx
- eslint.config.mjs
- engines
- public.approval_items
- public.approval_items
- public.approval_items

## God Nodes (most connected - your core abstractions)
1. `cn()` - 327 edges
2. `react` - 68 edges
3. `lucide-react` - 42 edges
4. `isRecord()` - 39 edges
5. `radix-ui` - 38 edges
6. `isString()` - 34 edges
7. `Button()` - 27 edges
8. `ConnectionHubRepository` - 20 edges
9. `postPlatform()` - 18 edges
10. `TrackingModule()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `AccordionContent()` --calls--> `cn()`  [EXTRACTED]
  components/ui/accordion.tsx → lib/utils.ts
- `AccordionItem()` --calls--> `cn()`  [EXTRACTED]
  components/ui/accordion.tsx → lib/utils.ts
- `AccordionTrigger()` --calls--> `cn()`  [EXTRACTED]
  components/ui/accordion.tsx → lib/utils.ts
- `AlertDescription()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert.tsx → lib/utils.ts
- `AlertTitle()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (91 total, 12 thin omitted)

### Community 0 - "cn"
Cohesion: 0.05
Nodes (53): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia(), AlertDialogOverlay() (+45 more)

### Community 1 - "ConnectionHubRepository"
Cohesion: 0.06
Nodes (23): dynamic, POST(), roleCanWrite(), ActorContext, AuthorizationSession, ConnectionHubRepository, unwrap(), CompositeTypes (+15 more)

### Community 2 - "sidebar.tsx"
Cohesion: 0.06
Nodes (39): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle(), Sidebar() (+31 more)

### Community 3 - "local-seo-operations.tsx"
Cohesion: 0.06
Nodes (30): dynamic, OpportunityOperations(), PostOperations(), approval(), save(), postStages, ReviewOperations(), reviewStages (+22 more)

### Community 4 - "alastre-google-ads-bridge/index.ts"
Cohesion: 0.08
Nodes (32): Actor, adminHeaders(), auditLocal(), extractImportedProfile(), generateWithGateway(), jsonHeaders, JsonObject, localRecord() (+24 more)

### Community 5 - "utils.ts"
Cohesion: 0.06
Nodes (22): AccordionContent(), AccordionItem(), AccordionTrigger(), Checkbox(), HoverCardContent(), RadioGroup(), RadioGroupItem(), ScrollArea() (+14 more)

### Community 6 - "react"
Cohesion: 0.13
Nodes (27): Message, Recognition, RecognitionEvent, seoQuick, trafficQuick, Approval, approvalStatuses, isApprovalArray (+19 more)

### Community 7 - "combobox.tsx"
Cohesion: 0.09
Nodes (23): ComboboxChip(), ComboboxChips(), ComboboxChipsInput(), ComboboxClear(), ComboboxContent(), ComboboxEmpty(), ComboboxGroup(), ComboboxInput() (+15 more)

### Community 8 - "package.json"
Cohesion: 0.07
Nodes (27): name, private, type, version, @cloudflare/vite-plugin, date-fns, drizzle-kit, drizzle-orm (+19 more)

### Community 9 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, @base-ui/react, class-variance-authority, clsx, cmdk, date-fns, drizzle-orm, embla-carousel-react (+19 more)

### Community 10 - "class-variance-authority"
Cohesion: 0.10
Nodes (21): Alert(), AlertDescription(), AlertTitle(), alertVariants, Empty(), EmptyContent(), EmptyDescription(), EmptyHeader() (+13 more)

### Community 11 - "tracking-module.tsx"
Cohesion: 0.09
Nodes (21): Candidate, Client, Deployment, ExecutionRun, isClients, labels, LoadError, operationLabel (+13 more)

### Community 12 - "google-adapter.ts"
Cohesion: 0.15
Nodes (13): Fetcher, GOOGLE_BUSINESS_SCOPE, GoogleAccount, GoogleLocation, GoogleProviderAdapter, GoogleProviderError, GoogleTokens, json() (+5 more)

### Community 13 - "isRecord"
Cohesion: 0.20
Nodes (24): isChatResponse(), isConversation(), isMessage(), isApproval(), isClientSummary(), isCreatedClient(), isSource(), isWorkspace() (+16 more)

### Community 14 - "20260909212000_tracking_provisioning_domain.sql"
Cohesion: 0.21
Nodes (21): anon, authenticated, public.platform_prepare_tracking_plan(), public.platform_tracking_workspace(), public.tracking_deployments, public.tracking_profiles, public.tracking_resources, public.tracking_templates (+13 more)

### Community 15 - "command.tsx"
Cohesion: 0.11
Nodes (16): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+8 more)

### Community 16 - "20260912185933_local_seo_security_hardening.sql"
Cohesion: 0.15
Nodes (20): public.local_seo_posts, public.local_seo_review_replies, public.local_seo_reviews, local_seo_opportunities_approval_idx, local_seo_opportunities_client_idx, local_seo_opportunities_created_actor_idx, local_seo_opportunities_updated_actor_idx, local_seo_posts_approval_idx (+12 more)

### Community 17 - "local-seo-module.tsx"
Cohesion: 0.15
Nodes (16): emptyV2, sections, V2Data, cards, CompetitorsWorkspace(), ExecutiveOverview(), HistoryWorkspace(), KeywordsWorkspace() (+8 more)

### Community 18 - "item.tsx"
Cohesion: 0.13
Nodes (17): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Item(), ItemActions(), ItemContent(), ItemDescription() (+9 more)

### Community 19 - "dropdown-menu.tsx"
Cohesion: 0.14
Nodes (13): options, ThemeSwitcher(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem() (+5 more)

### Community 20 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, @cloudflare/vite-plugin, drizzle-kit, eslint, eslint-config-next, react-server-dom-webpack, supabase, tailwindcss (+11 more)

### Community 21 - "public.tracking_execution_runs"
Cohesion: 0.16
Nodes (18): public.tracking_resource_candidates, public.platform_begin_tracking_workspace_execution(), public.platform_record_tracking_workspace_execution(), public.platform_tracking_workspace(), public.tracking_execution_runs, public.agencies, public.agency_actors, public.approval_items (+10 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - "20260912190349_connection_hub_foundation.sql"
Cohesion: 0.20
Nodes (14): client_resource_bindings_agency_client_idx, clients_agency_id_id_uq, integration_connections_agency_status_idx, integration_resources_agency_capability_idx, public.client_resource_bindings, public.connection_hub_get_secret(), public.integration_authorization_sessions, public.integration_connection_capabilities (+6 more)

### Community 24 - "app-shell.tsx"
Cohesion: 0.15
Nodes (13): AppShell(), groups, mobileItems, NavItem, View, viewLabels, views, ApprovalsModule() (+5 more)

### Community 25 - "menubar.tsx"
Cohesion: 0.12
Nodes (11): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarRadioItem(), MenubarSeparator(), MenubarShortcut() (+3 more)

### Community 26 - "connection-hub-domain.ts"
Cohesion: 0.12
Nodes (14): AuthorizationStatus, authorizationStatuses, CapabilityKey, ConnectionHealthStatus, ConnectionManagementMode, connectionManagementModes, ConnectionStatus, connectionStatuses (+6 more)

### Community 27 - "local-seo-data.ts"
Cohesion: 0.20
Nodes (11): buildLocalSeoWorkspace(), pillarLabels, GoogleBusinessProfileDataProvider, InternalLocalSeoDataProvider, LocalSeoDataProvider, resolveLocalSeoDataProvider(), text(), GoogleProfileSnapshot (+3 more)

### Community 28 - "public.tracking_resource_candidates"
Cohesion: 0.19
Nodes (16): public.platform_record_tracking_resource_candidates(), public.platform_select_tracking_resources(), public.platform_tracking_workspace(), public.tracking_resource_candidates, public.agencies, public.agency_actors, public.clients, public.platform_command_receipts (+8 more)

### Community 29 - "postPlatform"
Cohesion: 0.19
Nodes (13): AgentWorkspace(), dictate(), send(), ClientsModule(), analyze(), save(), DnaModule(), setDnaStatus() (+5 more)

### Community 30 - "connections/route.ts"
Cohesion: 0.24
Nodes (14): emailFrom(), POST(), friendlyConnectionError(), POST(), connectionHubRequest, providers, statusCopy, getGoogleOAuthConfig() (+6 more)

### Community 31 - "context-menu.tsx"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 32 - "20260913042436_local_seo_v2_foundation.sql"
Cohesion: 0.24
Nodes (15): local_seo_competitors_client_idx, local_seo_keywords_client_idx, local_seo_opportunities_open_rule_uq, local_seo_profile_checks_client_idx, local_seo_rank_snapshots_client_idx, local_seo_score_snapshots_client_idx, public.local_seo_competitors, public.local_seo_keywords (+7 more)

### Community 33 - "service.ts"
Cohesion: 0.30
Nodes (12): back(), GET(), b64url(), createOAuthProof(), hashOAuthState(), isAuthorizationSessionValid(), safeReturnPath(), discoverGoogleResources() (+4 more)

### Community 34 - "skills-module.tsx"
Cohesion: 0.18
Nodes (13): capabilities, SkillsModule(), statuses, emilMotion, owl, safe, SkillCategory, SkillRecord (+5 more)

### Community 35 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+6 more)

### Community 36 - "20260904122512_marco_1_foundation.sql"
Cohesion: 0.27
Nodes (14): agency_members_user_active_idx, audit_events_actor_idx, audit_events_agency_occurred_idx, audit_events_client_occurred_idx, clients_agency_status_idx, integrations_agency_client_idx, integrations_status_idx, public.agencies (+6 more)

### Community 37 - "20260908162515_security_stabilization.sql"
Cohesion: 0.25
Nodes (13): agency_actors_email_active_idx, platform_command_receipts_actor_created_idx, public.agency_actors, public.platform_command_receipts, public.platform_onboard_client(), public.platform_record_conversation(), public.platform_resolve_actor(), public.platform_set_dna_status() (+5 more)

### Community 38 - "public.tracking_candidate_artifacts"
Cohesion: 0.24
Nodes (14): public.platform_prepare_tracking_candidate(), public.platform_record_tracking_application(), public.platform_tracking_execution_gate(), public.platform_tracking_workspace(), public.tracking_candidate_artifacts, public.agencies, public.agency_actors, public.clients (+6 more)

### Community 39 - "foundation.sql"
Cohesion: 0.27
Nodes (14): agency_members_user_active_idx, audit_events_actor_idx, audit_events_agency_occurred_idx, audit_events_client_occurred_idx, clients_agency_status_idx, integrations_agency_client_idx, integrations_status_idx, public.agencies (+6 more)

### Community 40 - "TrackingModule"
Cohesion: 0.14
Nodes (7): isDiscoveryResult(), TrackingModule(), discover(), livePreflight(), prepareCandidate(), stageCandidate(), validateProduction()

### Community 41 - "local-score.tsx"
Cohesion: 0.15
Nodes (11): StatusExplanation(), labels, LocalScore(), LocalScorePillar, dataConfidenceLabels, keywordIntents, LocalRankProvider, LocalRankProviderStatus (+3 more)

### Community 42 - "chart.tsx"
Cohesion: 0.19
Nodes (12): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload(), INITIAL_DIMENSION (+4 more)

### Community 43 - "field.tsx"
Cohesion: 0.16
Nodes (12): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+4 more)

### Community 44 - "alastre-gtm-service/index.ts"
Cohesion: 0.21
Nodes (8): accessToken(), authorized(), decrypt(), env(), J, keyBytes(), sha256(), WRITE_ACTIONS

### Community 45 - "20260912185228_local_seo_operations.sql"
Cohesion: 0.33
Nodes (13): local_seo_opportunities_queue_idx, local_seo_posts_queue_idx, local_seo_review_replies_queue_idx, local_seo_reviews_queue_idx, public.local_seo_opportunities, public.local_seo_posts, public.local_seo_review_replies, public.local_seo_reviews (+5 more)

### Community 46 - "layout.tsx"
Cohesion: 0.17
Nodes (7): metadata, ThemeProvider(), nextConfig, @fontsource-variable/manrope, next, next-themes, sonner

### Community 47 - "form.tsx"
Cohesion: 0.21
Nodes (11): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+3 more)

### Community 48 - "20260910193000_tracking_complete_lifecycle.sql"
Cohesion: 0.23
Nodes (12): public.platform_begin_tracking_publish(), public.platform_begin_tracking_workspace_execution(), public.platform_decide_approval(), public.platform_record_tracking_production_validation(), public.platform_record_tracking_publication(), public.platform_record_tracking_staging(), public.platform_request_tracking_publish_approval(), public.agency_actors (+4 more)

### Community 49 - "connections-module.tsx"
Cohesion: 0.17
Nodes (9): ConnectionsModule(), GoogleConfiguration, HubClient, HubResource, icons, onboardingSteps, pendingGoogle, googleCloudAdministration (+1 more)

### Community 50 - "attachment.tsx"
Cohesion: 0.20
Nodes (11): Attachment(), AttachmentAction(), AttachmentActions(), AttachmentContent(), AttachmentDescription(), AttachmentGroup(), AttachmentMedia(), attachmentMediaVariants (+3 more)

### Community 51 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle(), vaul

### Community 52 - "alastre-ga4-service/index.ts"
Cohesion: 0.26
Nodes (8): accessToken(), authorized(), decrypt(), env(), J, keyBytes(), sha256(), WRITE_ACTIONS

### Community 53 - "public.ai_usage_events"
Cohesion: 0.32
Nodes (11): ai_cost_policies_agency_enabled_idx, ai_usage_events_agency_created_idx, ai_usage_events_client_created_idx, ai_usage_events_thread_idx, public.ai_cost_policies, public.ai_usage_events, public.platform_record_ai_usage(), public.agencies (+3 more)

### Community 54 - "20260909212800_tracking_foreign_key_indexes.sql"
Cohesion: 0.21
Nodes (11): public.tracking_deployments, public.tracking_profiles, public.tracking_resources, public.tracking_validations, tracking_deployments_actor_idx, tracking_deployments_profile_idx, tracking_profiles_client_idx, tracking_profiles_template_idx (+3 more)

### Community 55 - "public.platform_build_tracking_change_plan"
Cohesion: 0.20
Nodes (9): public.tracking_templates, public.platform_build_tracking_change_plan(), public.platform_decide_approval(), public.agency_actors, public.clients, public.platform_command_receipts, public.tracking_profiles, public.tracking_resources (+1 more)

### Community 56 - "20260904151205_marco_1_client_dna_agent_workspace.sql"
Cohesion: 0.38
Nodes (10): agent_messages_thread_created_idx, agent_threads_client_updated_idx, client_dna_agency_status_idx, intelligence_sources_client_type_idx, public.agent_messages, public.agent_threads, public.client_dna_profiles, public.client_intelligence_sources (+2 more)

### Community 57 - "operations-module.tsx"
Cohesion: 0.36
Nodes (9): Audit, isAudit(), isOps(), isUsage(), OperationsModule(), Ops, Usage, isArrayOf() (+1 more)

### Community 58 - "page-header.tsx"
Cohesion: 0.33
Nodes (6): OverviewModule(), HelpButton(), DailySeoQueue(), PageHeader(), HELP_CONTENT, HelpKey

### Community 59 - "navigation-menu.tsx"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 60 - "20260904130054_marco_1_google_ads_drafts_approvals.sql"
Cohesion: 0.33
Nodes (9): approval_items_agency_status_idx, approval_items_client_created_idx, google_ads_drafts_agency_created_idx, google_ads_drafts_client_status_idx, public.approval_items, public.google_ads_campaign_drafts, public, public.agencies (+1 more)

### Community 61 - "chatgpt-auth.ts"
Cohesion: 0.39
Nodes (8): chatGPTSignInPath(), chatGPTSignOutPath(), ChatGPTUser, getChatGPTUser(), isReservedAuthPath(), requireChatGPTUser(), safeDecodeURIComponent(), safeRelativeReturnPath()

### Community 62 - "popover.tsx"
Cohesion: 0.25
Nodes (4): PopoverContent(), PopoverDescription(), PopoverHeader(), PopoverTitle()

### Community 63 - "local-seo-types.ts"
Cohesion: 0.25
Nodes (7): LocalScorePillarKey, LocalSeoDataProvenance, LocalSeoDataState, LocalSeoOpportunityStatus, LocalSeoPostDraft, LocalSeoPostStatus, LocalSeoReviewStatus

### Community 64 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, db:generate, dev, install:ci, lint, start, test

### Community 65 - "20260904151906_marco_1_agent_foreign_key_indexes.sql"
Cohesion: 0.29
Nodes (7): public.agent_messages, public.client_intelligence_sources, agent_messages_agency_id_idx, agent_messages_client_id_idx, agent_threads_agency_id_idx, client_intelligence_sources_agency_id_idx, public.agent_threads

### Community 66 - "bubble.tsx"
Cohesion: 0.38
Nodes (6): Bubble(), BubbleContent(), BubbleGroup(), BubbleReactions(), bubbleReactionsVariants, bubbleVariants

### Community 67 - "public.client_services"
Cohesion: 0.38
Nodes (6): public.agency_members, client_services_agency_status_idx, client_services_client_status_idx, public.client_services, public.agencies, public.clients

### Community 68 - "input-otp.tsx"
Cohesion: 0.33
Nodes (4): InputOTP(), InputOTPGroup(), InputOTPSlot(), input-otp

### Community 69 - "tabs.tsx"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 70 - "public.platform_record_conversation_v2"
Cohesion: 0.47
Nodes (5): public.platform_ai_budget_status(), public.platform_record_conversation_v2(), public.agency_actors, public.agent_threads, public.clients

### Community 71 - "resizable.tsx"
Cohesion: 0.40
Nodes (3): ResizableHandle(), ResizablePanelGroup(), react-resizable-panels

### Community 72 - "server-config.ts"
Cohesion: 0.60
Nodes (3): ProviderAvailabilityStatus, getSupabaseServerConfig(), createSupabaseAdmin()

### Community 73 - "20260908211946_ai_gateway_foreign_key_indexes.sql"
Cohesion: 0.40
Nodes (4): public.ai_cost_policies, public.ai_usage_events, ai_cost_policies_client_id_idx, ai_usage_events_actor_id_idx

### Community 74 - "20260910131500_tracking_candidate_foreign_key_indexes.sql"
Cohesion: 0.60
Nodes (4): public.tracking_candidate_artifacts, tracking_candidate_actor_idx, tracking_candidate_agency_idx, tracking_candidate_profile_idx

## Knowledge Gaps
- **253 isolated node(s):** `AuthorizationSession`, `CompositeTypes`, `DatabaseWithoutInternals`, `DefaultSchema`, `Enums` (+248 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 432 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `sidebar.tsx`, `local-seo-operations.tsx`, `utils.ts`, `react`, `combobox.tsx`, `class-variance-authority`, `command.tsx`, `item.tsx`, `dropdown-menu.tsx`, `menubar.tsx`, `context-menu.tsx`, `carousel.tsx`, `chart.tsx`, `field.tsx`, `form.tsx`, `attachment.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `popover.tsx`, `bubble.tsx`, `input-otp.tsx`, `tabs.tsx`, `resizable.tsx`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `cn`, `sidebar.tsx`, `local-seo-operations.tsx`, `utils.ts`, `combobox.tsx`, `package.json`, `class-variance-authority`, `tracking-module.tsx`, `command.tsx`, `local-seo-module.tsx`, `item.tsx`, `dropdown-menu.tsx`, `app-shell.tsx`, `menubar.tsx`, `context-menu.tsx`, `skills-module.tsx`, `carousel.tsx`, `chart.tsx`, `field.tsx`, `form.tsx`, `connections-module.tsx`, `attachment.tsx`, `drawer.tsx`, `operations-module.tsx`, `page-header.tsx`, `navigation-menu.tsx`, `popover.tsx`, `bubble.tsx`, `input-otp.tsx`, `tabs.tsx`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `react` to `cn`, `sidebar.tsx`, `local-seo-operations.tsx`, `utils.ts`, `combobox.tsx`, `package.json`, `tracking-module.tsx`, `command.tsx`, `local-seo-module.tsx`, `dropdown-menu.tsx`, `app-shell.tsx`, `menubar.tsx`, `context-menu.tsx`, `skills-module.tsx`, `carousel.tsx`, `local-score.tsx`, `layout.tsx`, `connections-module.tsx`, `operations-module.tsx`, `page-header.tsx`, `navigation-menu.tsx`, `input-otp.tsx`, `resizable.tsx`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `isRecord()` (e.g. with `decide()` and `setDnaStatus()`) actually correct?**
  _`isRecord()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AuthorizationSession`, `CompositeTypes`, `DatabaseWithoutInternals` to the rest of the system?**
  _253 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.05336951605608322 - nodes in this community are weakly interconnected._
- **Should `ConnectionHubRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.05990338164251208 - nodes in this community are weakly interconnected._