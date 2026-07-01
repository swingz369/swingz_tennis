# Swingz (swingz@1.0.0)

This design system is the published swingz React library, bundled as a single
browser global. All 152 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.Swingz`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).
- `guidelines/` — the design system's own usage guidance (14 doc(s), see `guidelines/index.md`). Read these before composing larger layouts.

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.Swingz.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { AccessDenied } = window.Swingz;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<AccessDenied />);
```

## Tokens

48 CSS custom properties from swingz. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (7): `--surface`, `--surface-elevated`, `--border-subtle`, …
- **other** (41): `--background`, `--foreground`, `--card`, …

## Components

### general
- `AccessDenied`
- `Accordion`
- `AccordionContent`
- `AccordionItem`
- `AccordionTrigger`
- `AdminDashboardSkeleton`
- `Alert`
- `AlertDescription`
- `AlertTitle`
- `Avatar`
- `AvatarFallback`
- `AvatarImage`
- `AvatarUpload`
- `AvatarWithStatus`
- `Badge`
- `Button`
- `Card`
- `CardContent`
- `CardDescription`
- `CardFooter`
- `CardGridSkeleton`
- `CardHeader`
- `CardSkeleton`
- `CardTitle`
- `CenteredModal`
- `ChartSkeleton`
- `Checkbox`
- `Collapsible`
- `CollapsibleContent`
- `CollapsibleTrigger`
- `Command`
- `CommandDialog`
- `CommandEmpty`
- `CommandGroup`
- `CommandInput`
- `CommandItem`
- `CommandList`
- `CommandShortcut`
- `ConfirmDialog`
- `Dialog`
- `DialogClose`
- `DialogContent`
- `DialogDescription`
- `DialogFooter`
- `DialogHeader`
- `DialogOverlay`
- `DialogPortal`
- `DialogTitle`
- `DialogTrigger`
- `DropdownMenu`
- `DropdownMenuCheckboxItem`
- `DropdownMenuContent`
- `DropdownMenuGroup`
- `DropdownMenuItem`
- `DropdownMenuLabel`
- `DropdownMenuPortal`
- `DropdownMenuRadioGroup`
- `DropdownMenuRadioItem`
- `DropdownMenuSeparator`
- `DropdownMenuShortcut`
- `DropdownMenuSub`
- `DropdownMenuSubContent`
- `DropdownMenuSubTrigger`
- `DropdownMenuTrigger`
- `EmptyInboxState`
- `EmptyState`
- `ErrorState`
- `ExportButton`
- `FeatureCard`
- `ForbiddenState`
- `Form`
- `FormControl`
- `FormDescription`
- `FormField`
- `FormItem`
- `FormLabel`
- `FormMessage`
- `FormSkeleton`
- `FullPageLoading`
- `IconBox`
- `Input`
- `KPICardSkeleton`
- `KPISkeleton`
- `KPISkeletonGrid`
- `Label`
- `LoadingButton`
- `LoadingSpinner`
- `LogoUpload`
- `MiniChart`
- `NoBookingsEmptyState`
- `NoCourtsBrandedEmptyState`
- `NoInvoicesEmptyState`
- `NoMembersBrandedEmptyState`
- `NoMembersEmptyState`
- `NoSearchResultsEmptyState`
- `NoSeasonsBrandedEmptyState`
- `NoSessionsEmptyState`
- `NotFound`
- `NoTournamentsBrandedEmptyState`
- `NoTrainersBrandedEmptyState`
- `PageHeaderSkeleton`
- `PageLoader`
- `Popover`
- `PopoverContent`
- `PopoverTrigger`
- `Progress`
- `QueryError`
- `ScrollArea`
- `ScrollBar`
- `Select`
- `SelectContent`
- `SelectGroup`
- `SelectItem`
- `SelectLabel`
- `SelectScrollDownButton`
- `SelectScrollUpButton`
- `SelectSeparator`
- `SelectTrigger`
- `SelectValue`
- `Separator`
- `Skeleton`
- `Slider`
- `StatusBadge`
- `SuccessState`
- `Switch`
- `Table`
- `TableBody`
- `TableCaption`
- `TableCell`
- `TableFooter`
- `TableHead`
- `TableHeader`
- `TableRow`
- `TableSkeleton`
- `Tabs`
- `TabsContent`
- `TabsList`
- `TabsTrigger`
- `TennisBallEmptyState`
- `TennisBallGraphic`
- `Textarea`
- `Toast`
- `ToastAction`
- `ToastClose`
- `ToastDescription`
- `ToastProvider`
- `ToastTitle`
- `ToastViewport`
- `Tooltip`
- `TooltipContent`
- `TooltipProvider`
- `TooltipTrigger`
