import { redirect } from 'next/navigation';

/**
 * /news redirects to /messages — News & Nachrichten have been merged
 * into a single unified Kommunikation page.
 */
export default function NewsRedirectPage() {
  redirect('/messages');
}
