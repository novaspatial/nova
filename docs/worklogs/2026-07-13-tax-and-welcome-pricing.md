# Tax and honest welcome pricing

Date: 2026-07-13

Goal: with the client's rulings finally in hand, fix the 2 things live checkout was getting wrong with real money — charging no tax, and advertising 50% off while charging something else.

The client's answers to the 5 open commerce questions were recorded where decisions live: full HST in HST provinces, a returning client means a prior paid project, single-use codes burn only when payment succeeds, private codes may pierce the $225 floor via an explicit per-code flag, and the welcome offer is 15%. That opened every gated commerce chain at once; the 2 launch debts were taken the same day, and code redemption queues next.

The 50% promo copy is gone. 1 shared constant now feeds the popup, the footer, the login badge, and the private code checkout actually charges, so copy and charge can no longer drift apart. At 15% the floor never binds, so a first single-song order realizes the full discount — $276.25, where the old 50% silently clamped to the $225 floor. The signup promo token became value-agnostic so a future percentage change can't orphan already-recorded metadata.

Checkout now charges Canadian GST/HST: a billing country + province pair on the order form picks the rate — 13% Ontario, 14% Nova Scotia, 15% New Brunswick/Newfoundland/PEI, 5% elsewhere in Canada, 0 abroad — computed in the same pure pricing module as the rest of the math, on the discounted total, in USD. The tax line shows on the live quote and the payment step, the charge includes it, and the order row keeps the amount plus the buyer's location for the future receipt; 3 new columns joined the freeze that stops clients rewriting money fields, with the migration applied and probed on the remote. 629 tests pass — all 13 provinces, rounding edges, floor and add-on interaction, the checkout route's new rejections. Natural next slices: the homepage calculator, the receipt's tax line, and actual code redemption.
