// Shows the sign-in details of card owners' view-only logins (after creating a card, resetting a password,
// or creating logins for older cards), with a ready-to-send message to copy.
import { O } from '../lib/utils.js';
import { APP_URL } from '../lib/api.js';
import { Dialog, showDialog } from '../components/Dialog.jsx';
import { CopyButton } from '../components/CopyButton.jsx';

const SIGN_IN = O + APP_URL;

// The message you send to the card owner.
export const loginMessage = (name, { username, password }) =>
  `Hi${name ? ' ' + name : ''}, you can now see the statistics of your SBPO card (taps, views and clicks).\n\n` +
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
      <small className="dlg-hint">They sign in at <b>{SIGN_IN}</b>, then must choose their own password before they can see anything. They can only see their own card's statistics.</small>
    </Dialog>
  );
}

export const showLoginDetails = (title, text, items) =>
  showDialog(close => <LoginDetailsDialog title={title} text={text} items={items} onClose={close} />);
