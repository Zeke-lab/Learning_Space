ok now i already read some or the generated pdf
but it still have some confusion and ununderstandable sentences and words

i will talk about with the saniero
for the first the published pdf seem like the information book and slightly not like a tutor
for example (#### အသုံး ချ နိုင်
နို င်သည့် လုပ်
လု ပ်ငန်း ခွင်နယ်ပယ်များ (Real-World Applications)
Sales & Marketing: ဝဘ်ဆိုဒ်တွင် Form လာ ဖြ ည့်သော ဖော က်သည်အသစ်များ ၏ အချ က်အလက်ကို
CRM စနစ်ထဲသို့ ထည့်သွင်း ပြီး အလိုအ
လို
လျော က် Welcome Email ပို့ခြ င်း ။
Finance & Accounting: နေ့ စနေ့äရော င်း အား စာ ရင်း များ ကို Google Sheets မှဖတ်ကာ သတ်မှတ်ထား သော
ပုံစံဖြ င့် PDF Report ထုတ်ပြီး မန်နေန် နေဂျာ ထံ Telegram မှတစ်ဆင့် ပေး ပို့ခြ င်း ။
IT & Operations: Server များ ပုံမှန်အန် လုပ်
လု ပ်လုပ်
လု ပ်ခြ င်း ရှိမရှိ စော င့်ကြင့်ကြည့်ပြီး ဒေါ င်း သွား ပါ က သက်ဆိုင်ရာ
Engineer ထံသို့ Slack သို့မဟုတ်
ဟု တ်SMS ဖြ င့် ချ က်ချ င်း Alert ပေး ပို့ခြ င်း ။)
for two , i download all the chapter in one pdf
but in the explaination of this book there are many dublicate explaination (for example ) when i ask about n8n it write chapter 1 about the difference between traditional coding and n8n workflow and then in chapter 2 also wrote like Traditional Automation Platforms နှင့် ကွာ ခြား ချ က် and duplicate again and again in other chapters and other parts. the worst one is not mensioning the above to like the explaination even they duplicate. so i support you to do the prompt or some technique not to become and duplicate contents and even it need to explain again( explaination second time or third), link it to the above.

after that you check are we use database and in where? i want to store my pdf file and other in the database and refetch it at the UI severely. so note it in the todo list properly.

the third one is that in writing the content especially the code, there is some conflit in version of the technologies (react , n8n , ... ), for example the code version that wrote in the pdf is not same or match with the current version or mostly use version. as our book is prioritize the learner , we have to make sure the concept, understanding and praticle.

## Coding priority checklist

### 1) Tutor-style writing and non-duplicate explanations
- [x] Update the chapter-generation prompt to teach like a tutor instead of a reference summary.
- [x] Add rules to prevent repeated explanations of the same concept across chapters.
- [x] Require cross-chapter continuity: reference earlier concepts briefly and move forward instead of re-defining them.
- [x] Keep the content structured around learning flow, not just information dumping.
- [ ] To test: generate a multi-chapter book on a topic like n8n and confirm each chapter adds a new layer instead of repeating older explanations.

### 2) Database and storage decision
- [x] Confirm the current app does not use a database in the MVP.
- [x] Record that current persistence is browser localStorage for session recovery.
- [x] Document future backend storage for PDFs and exported books if cloud persistence is needed.
- [ ] To test: verify saved outlines and chapters restore after refresh from localStorage and that exported/generated content is still available in the UI.

to develop next, we need to create account and fetching the data that each user generate
user account name email and api web hook to the other ai that the user have. in currenty, database is used by all users and so no privancy when fetch the files form the database.

### 3) Version-safe technology examples
- [x] Add prompt instructions to prefer current stable technology patterns and modern syntax.
- [x] Add guidance to call out version assumptions when code examples depend on a framework or tool version.
- [x] Avoid legacy or outdated examples unless the chapter explicitly compares old and new methods.
- [ ] To test: generate a chapter using React, n8n, or similar tools and check that the examples match current stable usage patterns, not older or mismatched versions.

### 4) Output quality validation
- [x] Ensure the prompt is more learner-focused and less like a list of disconnected features.
- [x] Keep content more readable and practical.
- [ ] To test: review the rendered PDF/manuscript text for clarity, flow, repetition, and version correctness across several generated books.

### 5) Implementation status
- [x] Prompt fix completed.
- [x] Persistence fix completed.
- [x] TODO updated to reflect database/storage decision.
- [ ] Final regression testing remains to confirm all three issues are resolved in real generated output.

> Note: The prompt and app logic have been adjusted to address the user feedback. The remaining work is verification by generating real books and checking the output for repetition, clarity, storage behavior, and version alignment.
