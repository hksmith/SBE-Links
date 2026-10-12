// Shows the sign-in details of card owners' view-only logins (after creating a card, resetting a password,
// or creating logins for older cards), with a ready-to-send message to copy.
import { O } from '../lib/utils.js';
import { APP_URL, send } from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { Dialog, showDialog, confirmDialog } from '../components/Dialog.jsx';
import { CopyButton } from '../components/CopyButton.jsx';

const SIGN_IN = O + APP_URL;

// The message you send to the card owner.
// x.company: the company admin's sign-in (statistics of all the company's cards).
export const loginMessage = (name, { username, password, company }) =>
  (company
    ? `Hello, you can now see the statistics of all ${company} SBPO cards: the company totals and each person's card (taps, views and clicks).\n\n`
    : `Hi${name ? ' ' + name : ''}, you can now see the statistics of your SBPO card (taps, views and clicks).\n\n`) +
  `Sign in at: ${SIGN_IN}\nUsername: ${username}\nPassword: ${password}\n\n` +
  `The first time you sign in you will be asked to choose your own password.`;

// items: [{ name, username, password }]
function LoginDetailsDialog({ title, text, items, onClose }) {
  const all = items.map(x => loginMessage(x.name, x)).join('\n\n-----\n\n');
  return (
    <Dialog icon="people" title={title} text={text} confirm="Done" cancel="Close" onClose={onClose}>
      <div className="creds">
        {items.map(x => (
          <div key={x.username} className="cred">
            <div>
              {x.name && <b>{x.name}</b>}
              <small>Username: <code>{x.username}</code> · Password: <code>{x.password}</code></small>
            </div>
            <CopyButton text={loginMessage(x.name, x)}>Copy message</CopyButton>
          </div>
        ))}
      </div>
      {items.length > 1 && <CopyButton className="blk" text={all}>Copy all {items.length} messages</CopyButton>}
      <small className="dlg-hint">They sign in at <b>{SIGN_IN}</b>, then must choose their own password before they can see anything. {items.some(x => x.company) ? 'The company admin sees the totals of all the company’s cards and each person’s card — view only.' : 'They can only see their own card’s statistics.'}</small>
    </Dialog>
  );
}

// "Sign-in" button on each card of the dashboard. a = the card from /api/accounts (with a.login).
// Resolves true when something changed (so the list can reload).
export async function cardSignIn(a) {
  const name = a.name || a.slug;
  try {
    if (!a.login) { // no sign-in (deleted earlier): make one
      const login = await send(`/api/accounts/${a.id}/login`, 'POST', undefined, 'Could not create the sign-in.');
      showLoginDetails('Sign-in created', 'Send this to the card owner so they can see their statistics.', [{ name, ...login }]);
      return true;
    }
    if (a.login.mustChange) { // still on the first-time password: show it again
      showLoginDetails(`${name}'s sign-in`, 'They haven’t signed in yet. Send them this message.', [{ name, ...a.login }]);
      return false;
    }
    const ok = await confirmDialog({ // they chose their own password, which nobody else can see
      title: `${name} has set their own password`, icon: 'profile', danger: false, confirm: 'Reset password',
      text: `Username: ${a.login.username}. If they forgot their password, reset it to the first-time password and send them a new message. They will be signed out and choose a new one.`,
    });
    if (!ok) return false;
    const login = await send(`/api/users/${encodeURIComponent(a.login.username)}/reset`, 'POST', undefined, 'Could not reset the password.');
    showLoginDetails('Password reset', 'Send them these sign-in details.', [{ name, ...login }]);
    return true;
  } catch (e) {
    toast(e.message, { error: true });
    return false;
  }
}

export const showLoginDetails = (title, text, items) =>
  showDialog(close => <LoginDetailsDialog title={title} text={text} items={items} onClose={close} />);
