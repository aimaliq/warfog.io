import React from 'react';

export const TermsPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-4xl">

        {/* Header */}
        <h1 className="text-3xl font-black text-lime-500 mb-2">TERMS OF SERVICE</h1>
        <p className="text-sm text-gray-500 mb-8">Last Updated: December 2025</p>

        {/* Content */}
        <div className="bg-black/60 border-2 border-lime-900 p-6 space-y-6 text-sm text-gray-300 leading-relaxed">

          {/* 1. Acceptance */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">1. ACCEPTANCE OF TERMS</h2>
            <p>
              By accessing or using WARFOG.IO ("the Platform"), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, do not use the Platform.
            </p>
          </section>

          {/* 2. Eligibility */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">2. ELIGIBILITY</h2>
            <p className="mb-2">You must meet the following requirements to use the Platform:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Be at least 18 years of age</li>
              <li>Have the legal capacity to enter into binding agreements</li>
              <li>Not be located in a jurisdiction where online gaming or cryptocurrency use is prohibited</li>
              <li>Comply with all applicable local, state, and federal laws</li>
            </ul>
          </section>

          {/* 3. Game Rules */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">3. GAME RULES & MECHANICS</h2>
            <p className="mb-2">WARFOG.IO is a strategic defense game where:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Players defend their nuclear silos while attacking opponent silos</li>
              <li>Each player has 5 silos with 2 HP each</li>
              <li>Players select 2 silos to defend and 3 enemy silos to attack each turn</li>
              <li>First player to destroy 3 enemy silos wins</li>
              <li>Matches have a 10-second turn timer</li>
              <li>Fog of war: You cannot see enemy HP or defended silos</li>
            </ul>
          </section>

          {/* 4. Wallet Connection */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">4. WALLET CONNECTION & AUTHENTICATION</h2>
            <p className="mb-2">
              The Platform uses Solana wallet authentication for user and transaction verifications:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>You are the sole responsible for securing your own wallet and private keys</li>
              <li>The Platform does not store or have access to your private keys</li>
              <li>You can play as a guest without connecting a wallet (free matches only)</li>
              <li>Wallet connection is required for wagered matches, deposits, and withdrawals</li>
              <li>The Platform does not control your wallet - all transactions require your explicit approval</li>
            </ul>
          </section>

          {/* 5. Deposits & Withdrawals */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">5. DEPOSITS & WITHDRAWALS</h2>
            <p className="mb-2">When using wagered match features:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Deposits: You transfer SOL from your wallet to your game balance</li>
              <li>Game balance is stored in the Platform's secure treasury wallet</li>
              <li>Withdrawals: You can request to withdraw SOL from your game balance to your wallet at any time</li>
              <li>All blockchain transactions are irreversible</li>
              <li>You are responsible for network fees (gas)</li>
              <li>Minimum bet amount: {import.meta.env.VITE_MIN_BET_AMOUNT || 0.1} SOL</li>
              <li>Maximum bet amount: {import.meta.env.VITE_MAX_BET_AMOUNT || 1.0} SOL</li>
            </ul>
          </section>

          {/* 6. Platform Fees */}
          <section>
            <h2 className="text-lime-500 font-bold text-lime-500 text-lg mb-2">6. PLATFORM FEES</h2>
            <p className="mb-2">
              The Platform charges a 5% fee on wagered matches:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>The fee is deducted from the total pot at the end of each wagered match</li>
              <li>The winner receives 95% of the pot</li>
              <li>Example: 0.1 SOL bet × 2 players = 0.2 SOL pot → Winner gets 0.19 SOL, Platform gets 0.01 SOL</li>
              <li>Free matches have no fees</li>
              <li>Deposits and withdrawals have no Platform fees (only network fees)</li>
            </ul>
          </section>

          {/* 7. Prohibited Conduct */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">7. PROHIBITED CONDUCT</h2>
            <p className="mb-2">You may NOT:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Use bots, scripts, or automated tools to play matches</li>
              <li>Exploit bugs or glitches for unfair advantage</li>
              <li>Collude with other players to manipulate outcomes</li>
              <li>Engage in money laundering or illegal activity</li>
              <li>Harass, threaten, or abuse other players</li>
              <li>Reverse engineer or attempt to hack the Platform</li>
            </ul>
            <p className="mt-2">
              Violation of these terms may result in account suspension and forfeiture of funds.
            </p>
          </section>

          {/* 8. Intellectual Property */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">8. INTELLECTUAL PROPERTY</h2>
            <p>
              All content, graphics, code, and game mechanics on the Platform are owned by WARFOG.IO and
              protected by copyright and intellectual property laws. You may not copy, reproduce, or distribute
              any Platform content without written permission.
            </p>
          </section>

          {/* 9. Disclaimers */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">9. DISCLAIMERS & RISKS</h2>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>The Platform is provided "AS IS" without warranties of any kind</li>
              <li>Cryptocurrency and blockchain transactions carry inherent risks</li>
              <li>SOL value can be volatile - you may lose money</li>
              <li>Smart contracts and code may contain bugs or vulnerabilities</li>
              <li>The Solana blockchain may experience downtime or congestion</li>
              <li>We are not responsible for wallet hacks, phishing, or user error</li>
              <li>Online gaming involves risk - only wager what you can afford to lose</li>
            </ul>
          </section>

          {/* 10. Limitation of Liability */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">10. LIMITATION OF LIABILITY</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WARFOG.IO AND ITS OPERATORS SHALL NOT BE LIABLE
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOSS OF FUNDS,
              DATA, OR PROFITS, ARISING FROM YOUR USE OF THE PLATFORM.
            </p>
            <p className="mt-2">
              Platform liability shall not exceed the amount of fees paid to the Platform in the 12 months
              prior to the claim.
            </p>
          </section>

          {/* 11. Dispute Resolution */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">11. DISPUTE RESOLUTION</h2>
            <p>
              Any disputes arising from these Terms shall be resolved through binding arbitration in accordance
              with the rules of the American Arbitration Association. You waive your right to participate in
              class action lawsuits.
            </p>
          </section>

          {/* 12. Changes to Terms */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">12. CHANGES TO TERMS</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be posted on this page with
              an updated "Last Updated" date. Your continued use of the Platform after changes constitutes
              acceptance of the new Terms.
            </p>
          </section>

          {/* 13. Termination */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">13. TERMINATION</h2>
            <p>
              We may suspend or terminate your account at any time for violation of these Terms or at our sole
              discretion. Upon termination, you may withdraw any remaining funds from your game balance, subject
              to verification requirements.
            </p>
          </section>

          {/* 14. Contact */}
          <section>
            <h2 className="text-lime-500 font-bold text-lg mb-2">14. CONTACT INFORMATION</h2>
            <p className="mb-2">For questions about these Terms, contact us:</p>
            <ul className="list-none space-y-1">
              <li>X: <a href="https://x.com/warfog_io" target="_blank" rel="noopener noreferrer" className="text-lime-500 hover:underline">@warfog_io</a></li>
              <li>Telegram: <a href="https://t.me/warfog_io" target="_blank" rel="noopener noreferrer" className="text-lime-500 hover:underline">t.me/warfog_io</a></li>
            </ul>
          </section>

          {/* Acknowledgment */}
          <section className="border-t border-lime-900 pt-6 mt-8">
            <p className="text-yellow-500">
              BY USING WARFOG.IO, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
