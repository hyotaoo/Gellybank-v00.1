import { H2, LegalPage, LegalTable, List, P } from '@/pages/legal/LegalPage';

const TermsPage = () => (
  <LegalPage title="Terms of Agreement" version="v1.0, 2026-11-03">
    <H2>1. Acceptance</H2>
    <P>
      By ticking the agreement box and creating an account, you agree to these Terms with Gelly Bank
      ("Gelly Bank", "we", "us"). If you do not agree, do not create an account. These Terms apply to
      every Gelly Bank service you use, including the website, the customer dashboard and any related
      notification.
    </P>

    <H2>2. Who may open an account</H2>
    <P>To open an account you must:</P>
    <List>
      <li>be at least 18 years old;</li>
      <li>provide true, complete and current personal information, and keep it updated;</li>
      <li>open and use the account only for yourself, never on behalf of someone else;</li>
      <li>complete any identity verification we require.</li>
    </List>
    <P>
      We may refuse an application, or ask for more information, without being obliged to give a reason
      beyond what is shown in your application status.
    </P>

    <H2>3. User roles</H2>
    <P>Gelly Bank has three kinds of users, each with limited powers.</P>
    <LegalTable
      headers={['Role', 'What they can do', 'What they cannot do']}
      rows={[
        [
          'Customer',
          'View balances and history, request deposits and withdrawals, transfer funds, apply for more accounts, manage personal details and security',
          'Approve their own requests or see other customers\' accounts',
        ],
        [
          'Teller',
          'Look up customer accounts, verify identity and cash, approve or reject deposit and withdrawal requests, record the final status',
          'Change balances arbitrarily or change system settings',
        ],
        [
          'Admin',
          'Create and deactivate Teller accounts, review and decide account applications, monitor transactions, view summary reports',
          'Process customer transactions, or silently edit or delete transaction amounts and records',
        ],
      ]}
    />

    <H2>4. Opening an account</H2>
    <List>
      <li>You submit an application for a Savings or Checking account with the required information.</li>
      <li>An Admin reviews it and either approves it, rejects it with a stated reason, or asks for more information.</li>
      <li>The account becomes usable only after approval. You can track the status and read any rejection reason in your dashboard.</li>
      <li>After approval you may apply for additional Savings or Checking accounts using the same process.</li>
      <li>Only one person may use one account, and you may not sell, rent or transfer your account to anyone.</li>
    </List>

    <H2>5. Deposits</H2>
    <P>Deposits are cash deposits confirmed by a Teller.</P>
    <List>
      <li>You submit a deposit request, choosing the receiving account and amount, with an optional note.</li>
      <li>The request enters the Teller's queue as PENDING.</li>
      <li>You present the cash to a Teller, who verifies the amount and the receiving account.</li>
      <li>When the Teller confirms the deposit, the system credits the account and marks the transaction COMPLETED.</li>
    </List>
    <P>
      Your balance does not change until the Teller confirms. If the cash presented differs from the
      amount requested, or the request cannot be verified, the Teller may reject it and record the reason.
    </P>

    <H2>6. Withdrawals</H2>
    <List>
      <li>You submit a withdrawal request for a chosen account and amount.</li>
      <li>The system checks your available balance and applicable limits.</li>
      <li>A Teller verifies your identity and the request, then approves or rejects it.</li>
      <li>After approval, you receive the cash and the Teller confirms disbursement. Only then is the withdrawal recorded as COMPLETED.</li>
    </List>
    <P>
      A request that exceeds your available balance or limits, or whose identity check fails, will be
      rejected. You will see a reference number for every completed withdrawal.
    </P>

    <H2>7. Transfers</H2>
    <P>Transfers between accounts are electronic and do not wait for a Teller.</P>
    <List>
      <li>You enter the recipient's account number. The system shows the verified recipient name before you continue. Check it carefully.</li>
      <li>You review the amount, any fee and the details, then confirm with your PIN or another authentication step.</li>
      <li>The system validates the recipient, balance and limits, and then processes the transfer as one all-or-nothing operation. Both accounts and both transaction records are updated together, or neither is.</li>
      <li>You receive a confirmation once the transfer is completed.</li>
    </List>
    <P>
      A confirmed transfer is final. Gelly Bank cannot recall funds sent to an account number you entered
      correctly. If you believe a transfer was unauthorised or sent in error, report it immediately under
      Section 12.
    </P>

    <H2>8. Transaction statuses and records</H2>
    <P>Every request carries one of four statuses.</P>
    <LegalTable
      headers={['Status', 'Meaning']}
      rows={[
        ['PENDING', 'You submitted the request and Teller action is still needed'],
        ['COMPLETED', 'The financial operation was successfully executed'],
        ['REJECTED', 'The request was declined, and the reason is recorded'],
        ['CANCELLED', 'The request was cancelled before it was executed'],
      ]}
    />
    <P>
      Each transaction receives a reference number. Our records, including the Teller who processed a
      transaction, are kept as the official record of your activity. Staff cannot silently edit an amount
      or delete a record. If you find an error, tell us and it will be corrected through a recorded entry.
    </P>

    <H2>9. Your security responsibilities</H2>
    <List>
      <li>Keep your password and PIN secret. Never share them, even with someone who says they are from Gelly Bank. We will never ask for them.</li>
      <li>Choose a strong password you do not use elsewhere, and change it if you suspect it is known to someone else.</li>
      <li>Review your notifications and transaction history regularly.</li>
      <li>Sign out after each session, especially on shared devices.</li>
      <li>Tell us immediately if you notice a transaction you did not make, or if your credentials may be compromised.</li>
    </List>
    <P>
      Activity done with your credentials is treated as done by you, unless you reported the compromise
      before it happened or we were at fault.
    </P>

    <H2>10. AI Insights</H2>
    <P>
      AI Insights shows spending breakdowns, trends, budget suggestions, unusual-spending alerts and
      savings tips based on your own transaction records.
    </P>
    <List>
      <li>AI-generated suggestions are general information, not financial, tax or investment advice. Decide for yourself whether to act on them.</li>
      <li>Your balances, statuses and transaction records are the verified banking information. Insights and categories may be estimated and can be wrong.</li>
      <li>An unusual-spending alert is not proof of fraud. If you did not make a transaction, report it under Section 12.</li>
    </List>
    <P>How your data is used for this feature is explained in Part B.</P>

    <H2>11. Prohibited use</H2>
    <P>You must not:</P>
    <List>
      <li>use your account for fraud, money laundering, terrorist financing or any other unlawful purpose;</li>
      <li>give false identity details or open accounts under another person's identity;</li>
      <li>access or try to access another user's account, or any part of the system you are not permitted to use;</li>
      <li>interfere with the system, for example by scanning for weaknesses, overloading it, or bypassing limits and authentication;</li>
      <li>use bots, scripts or other tools to submit requests in a way that disrupts service;</li>
      <li>help anyone else do any of the above.</li>
    </List>

    <H2>12. Reporting problems and disputes</H2>
    <P>
      Report unauthorised or mistaken transactions, lost credentials or suspected fraud as soon as you
      notice them, using the contact details in Section 18. Include the reference number, date and amount.
      We will acknowledge your report, investigate, and tell you the outcome and any correction made.
      Reports made promptly give us the best chance of limiting loss.
    </P>

    <H2>13. Fees and limits</H2>
    <P>
      Fees, if any, are shown before you confirm a transaction. Current fees: none for deposits,
      withdrawals, or transfers between Gelly Bank accounts.
    </P>
    <P>
      Transaction limits apply: transfers of up to ₱50,000 each and ₱100,000 per day, and cash
      withdrawals of up to ₱50,000 per day. We may apply lower limits for security or compliance reasons.
    </P>
    <P>₱100 minimum balance is required to open or keep a Savings or Checking account.</P>
    <P>
      Interest on Savings accounts. Savings accounts earn interest at 3% per year. Interest is calculated
      each day on your ending balance, credited to your account once a month, and shown in your transaction
      history. Interest is reduced by taxes the law requires us to withhold (currently a 20% final
      withholding tax on peso deposit interest), so the amount credited is net of tax. Checking accounts do
      not earn interest. We may change the rate by giving you notice under Section 17.
    </P>

    <H2>14. Suspension and closure</H2>
    <P>
      We may restrict, suspend or close an account, or deactivate access, if we reasonably suspect fraud or
      unlawful activity, if you break these Terms, if information you gave is false, or if the law requires
      it. Where the law allows, we will tell you why. You may ask to close your account at any time once
      your balance is withdrawn and no transaction is pending. Closing an account does not erase records we
      must keep by law (see Part B, Section 6).
    </P>

    <H2>15. Our responsibility</H2>
    <P>
      We will operate Gelly Bank with reasonable care and protect your account and funds as required by
      law. We are not responsible for losses caused by your sharing of credentials, by your entering a
      wrong recipient account number, by events outside our control (such as power or network failure), or
      by your reliance on AI Insights as financial advice. Nothing in these Terms removes rights that the
      law gives you as a consumer of financial services.
    </P>

    <H2>16. Governing law</H2>
    <P>
      These Terms are governed by the laws of the Republic of the Philippines. Disputes are first raised
      with us under Section 12. If unresolved, they may be brought to the appropriate regulator or the
      proper courts of Nagcarlan, Laguna.
    </P>

    <H2>17. Changes to these Terms</H2>
    <P>
      We may update these Terms. We will notify you through the dashboard and notifications before material
      changes take effect. Continuing to use your account after the effective date means you accept the
      updated Terms. If you do not accept, you may close your account.
    </P>

    <H2>18. Contact</H2>
    <P>
      Gelly Bank, 123 Sample Street, Nagcarlan, Laguna 4002, Philippines. Email: support@gellybank.com.
      Phone: (02) 8000 0000. Teller service hours: Monday to Friday, 9:00 AM to 4:00 PM. Online banking is
      available 24 hours a day.
    </P>
  </LegalPage>
);

export default TermsPage;
