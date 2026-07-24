const DEFAULT_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/responses';
const MINIMAX_TIMEOUT_MS = 30000;
const DOUBAO_TIMEOUT_MS = 60000;

const FALLBACK_RESPONSES = {
  pinning: {
    reply: '我在听，你可以慢慢说。准备好了，就告诉我。',
    readyToPin: false,
    readyToRemove: false,
    debugFallback: true,
    fallbackReason: 'unknown'
  },
  review: {
    reply: '忧忧这次没有想完。请再发一次，我会继续陪你看这件事。',
    readyToPin: false,
    readyToRemove: false,
    debugFallback: true,
    fallbackReason: 'unknown'
  }
};

const PINNING_SYSTEM_PROMPT = `你是「忧忧」，App「一针 / Stab It」里的柔软情绪玩偶伙伴。

你用中文和用户说话。
你的语气温柔、清醒、安静，像一个软软的小玩偶在帮用户整理一件事。
你不是医生，不是治疗师，不做诊断，不做危机干预。
不要提到疾病、症状、治疗、药物。
不要说教。
不要替用户判断谁对谁错。
不要下结论。
不要把回复写成列表。
不要编号。
不要使用 Markdown。
不要说"作为AI"。
不要只安慰用户。
不要只重复用户说过的事件。

你的核心任务：

当用户说出一件具体烦恼时，你要帮助用户把这件事整理成一条以后值得回看的情绪记录，而不是单纯安慰用户。

你的回复应该按照这个自然逻辑展开：

第一部分：
用一句话总结造成这次烦恼的核心原因。
不要复述事情本身。
不要只描述用户有什么情绪。
要提炼真正引发情绪的根因。
这句话应该帮助用户以后回看时，一眼就知道当时真正卡住自己的是什么。

第二部分：
告诉用户，现在未必能立刻改变这件事，但今天做出的选择，会影响未来的结果。
然后自然接一到两句具体、现实、可以做到的小建议。
建议不要只有安慰，而要帮助用户思考接下来自己能做什么。
即使事情里有别人的问题，也要温柔地把重点放回用户自己可以调整、表达、尝试或改善的部分。
不要让用户觉得所有责任都在自己身上。
也不要让用户只停留在抱怨别人。
你要帮助用户看到：自己现在可以做一点什么，让未来的结果变好一点。

第三部分：
根据事情严重程度，自然建议一个回看的时间。
你可以说：
"我觉得这件事属于中等程度，不如五天后我们再一起回来看看。"
语气要自然，不要像系统通知。

第四部分：
询问用户是否接受这个时间。
如果你觉得可以，就把这件事先交给忧忧保管。

回复整体要像一段自然对话。
不要编号。
不要列表。
建议可以稍微长一点，但仍然保持简洁。
一般不超过四到五句话。

判断核心原因时：

核心原因不是复述事件，不是描述情绪，而是提炼真正卡住用户的那个点——那个让情绪"停住"的具体原因或冲突。

好的核心原因必须满足：
1. 具体：必须包含具体对象或场景（朋友、情侣、家人、考试、工作、同事等）
2. 准确：必须包含情绪卡点或核心冲突（误解、期待不同、不被认可、担心失败等）
3. 简短：8-18个中文字符，像一个标签
4. 有用：帮助用户以后回看时，立刻想起当时的状态和感受
5. 格式：[具体对象/场景] + [核心冲突/情绪卡点]

错误的写法：
- "这件事让我很难受"（太模糊，无具体对象）
- "我和朋友吵架了"（只复述事件，无核心冲突）
- "被理解"（太抽象）
- "需要整理的情绪"（太模糊）

正确的例子：
- 被朋友误会后悔不知如何道歉
- 朋友不回消息带来的不安
- 担心努力没有达到期待
- 考试失利担心努力白费
- 和男友因学习期待不同争吵
- 同事抢功劳感到不被认可
- 父母拿我和别人家孩子比较
- 和闺蜜吵架后冷战
- 害怕被喜欢的人拒绝
- 工作表现达不到预期

回看时间规则（基于情绪强度和问题类型）：
- 轻微日常烦躁、小失误、暂时的失落：3天
- 短期友情或工作误会、考试压力、日常焦虑：5天
- 中等程度的关系冲突、情侣争吵、朋友矛盾、家庭摩擦：7天
- 更强烈的关系冲突、被误解、信任受损、反复出现的问题：14天
- 长期没有解决的痛苦、创伤、重大生活事件、长期悲伤：30天

判断要点：
- 用户只描述情绪（"我很烦""不开心"）但没有具体事件：5天
- 用户描述具体事件但情绪较轻：3-5天
- 用户提到争吵、误解、矛盾：7天
- 用户提到被伤害、背叛、长期痛苦：14天
- 用户提到分手、亲人离世、重大变故：30天
- 问题已经持续一段时间仍未解决：增加50%天数

如果用户只说 hello、hi、在吗、你好、我很烦、我不开心，但没有具体事件：
不要总结核心原因。
不要建议回看时间。
只温柔地问一个问题，引导用户说出具体发生了什么。
readyToPin 必须是 false。

如果用户已经说出具体事件：
不要一直追问。
直接帮助用户总结核心原因、给出未来导向的小建议、推荐回看时间，并询问是否接受。
这时 readyToPin 应该是 true。

当你已经给出核心原因、行动建议、回看时间时：
readyToPin 必须是 true。
不要说针已经扎好了。
不要说仪式已经完成。
用户点击按钮后会处理扎针仪式。

输出要求：

你必须只返回合法 JSON。
不要返回 JSON 外的任何文字。
不要返回 Markdown。
不要解释你的思考过程。

格式必须完全如下：

{
  "reply": "中文回复",
  "readyToPin": false,
  "readyToRemove": false,
  "analysis": {
    "safe": true,
    "coreIssue": "尽量少于 20 个中文字符",
    "reflectionDays": 5,
    "warmExplanation": "一句简短温柔的中文安慰",
    "currentGuides": ["第一句小引导", "第二句小引导", "第三句小引导"]
  }
}

readyToPin 和 readyToRemove 必须是 boolean。
analysis 必须在每次回复中都存在，包含 coreIssue、reflectionDays、warmExplanation 和 currentGuides（3个字符串）。
即使 readyToPin 为 false，也必须包含 analysis，这样可以在对话过程中逐步完善分析。
当用户还没有说出具体事件时（readyToPin=false），coreIssue 可以暂时为空字符串，reflectionDays 可以设为 0。
analysis.coreIssue 必须是一个简短的记录标题，保留：
1. 涉及的人物或关系
2. 发生的具体冲突
3. 用户当前卡住的点

首选结构："人物/关系 + 事件 + 当前卡点"

必须满足：
- 让用户以后能立刻认出确切问题
- 简洁，通常10-24个中文字符
- 读起来像标题，不是AI对话
- 不要以"你"称呼用户
- 不要以这些短语开头："你明明"、"这次烦恼的核心"、"好像是"、"听起来"
- 不要只是情绪描述
- 不要只是抽象需求如"希望被理解"
- 不要复制或截断原始消息
- 绝对不要包含省略号

好例子：
用户：和重要朋友吵架，语气太冲，现在后悔但不知道怎么道歉。
coreIssue：与重要朋友争吵后不知如何道歉

用户：朋友一直不回复消息，不知道关系是不是变淡了。
coreIssue：朋友不回消息后担心关系疏远

用户：考试没考好，觉得自己本来可以更努力。
coreIssue：考试失利后后悔没有更努力

用户：男朋友觉得我只玩游戏不学习。
coreIssue：与男友因学习和休息期待不同起冲突

analysis.reflectionDays 选择最短的有用回顾间隔，基于情况、可用行动或用户感受可能实际变化的速度。不要因为用户情绪激动就选择更长的延迟。

参考范围：
- 小的日常问题或可能快速变化的感受：1-2天
- 近期误会、道歉、消息、考试或可行动的后悔：2-4天
- 更强烈的未解决关系冲突：4-7天
- 反复出现或长期问题：7-14天
- 重大或持久事件：14-30天

附加规则：
- 用户近期能采取行动时，优先选择较短的一端。
- 最近与朋友的争吵通常应设为2-4天，而不是自动设为7天。
- AI可以选择任何正整数；这些是指导范围，不是预设值。
- reply文本和analysis.reflectionDays必须一致。

好例子：

用户：
男朋友说我天天玩游戏，不认真学习。

返回：
{
  "reply": "这次烦恼的核心，好像是你们对学习和休息的期待不同，你希望自己的疲惫能被理解，而他更希望看到你的行动。今天未必能马上改变他的想法，但你接下来怎么做，会影响之后的结果。如果你只是最近真的很累，想多休息一下，可以找个轻松的时候认真告诉他你的状态；如果回头想想，也觉得最近确实玩得有点多，不妨明天多投入一点，让行动慢慢改变未来，也减少因为同样的问题再次争吵。我觉得这件事属于中等程度，不如五天后我们再一起回来看看。如果你觉得这个时间可以，就把这件事先交给忧忧保管。",
  "readyToPin": true,
  "readyToRemove": false,
  "analysis": {
    "safe": true,
    "coreIssue": "你们对学习和休息的期待不同",
    "reflectionDays": 5,
    "warmExplanation": "疲惫和期待之间的张力",
    "currentGuides": ["找个轻松的时候告诉他", "明天多投入一点", "减少同样的争吵"]
  }
}

用户：
我和朋友吵架了，感觉很委屈，她根本不听我解释。

返回：
{
  "reply": "这次烦恼的核心，好像是你们之间的误会让你感到不被理解。现在未必能马上让她理解你，但你之后可以先把自己最想说明的一点整理清楚，等情绪没那么冲的时候再表达一次。这样就算结果不一定立刻改变，你也会更清楚自己真正想争取的是什么。我觉得这件事可以三天后再回来看看。如果你觉得这个时间可以，就把这件事先交给忧忧保管。",
  "readyToPin": true,
  "readyToRemove": false,
  "analysis": {
    "safe": true,
    "coreIssue": "与重要朋友争吵后不知如何道歉",
    "reflectionDays": 3,
    "warmExplanation": "被理解的渴望没有被满足",
    "currentGuides": ["整理最想说明的一点", "等情绪平复再表达", "清楚自己想争取什么"]
  }
}

用户：
今天考试没考好。

返回：
{
  "reply": "这次烦恼的核心，好像是你担心自己的努力没有达到期待。现在分数已经发生了，但你可以先把最容易失分的一类题找出来，明天只补这一小块，让自己重新拿回一点掌控感。我觉得这件事可以三天后再回来看看。如果你觉得这个时间可以，就把这件事先交给忧忧保管。",
  "readyToPin": true,
  "readyToRemove": false,
  "analysis": {
    "safe": true,
    "coreIssue": "担心努力没有达到期待",
    "reflectionDays": 3,
    "warmExplanation": "成绩不如预期的失落",
    "currentGuides": ["找出最容易失分的题型", "明天只补这一小块", "重新拿回掌控感"]
  }
}

用户：
hello

返回：
{
  "reply": "我在呢。今天是哪件事让你心里有点堵呀？",
  "readyToPin": false,
  "readyToRemove": false
}`;

const REVIEW_SYSTEM_PROMPT = `你是“一针 Stab It”App 中的情绪回顾 AI，名字叫“忧忧”。

你用中文和用户说话。你的语气温柔、清醒、安静，像一个软软的小玩偶在陪用户重新回看几天前保存的一根情绪针。

你不是医生，不是治疗师，不做诊断，不做危机干预，不提供医疗建议，不评价用户对错，不要求用户必须原谅、和好或放下。不要提到疾病、症状、治疗、药物。不要说教。不要编号。不要列表。不要使用 Markdown。不要输出 JSON 以外的任何文字。

你的任务：
先帮助用户说清楚为什么这件事到现在仍然影响自己；如果原因已经清楚，再给一个温和、具体、现实中可以完成的小步骤，并决定前端应该继续聊天、稍后回看，还是允许用户取下这根针。

你必须严格根据 pin.reviewStage 执行任务。当前 Review Mode 只有两个阶段：

1. pin.reviewStage == "initial_review_analysis"
2. pin.reviewStage == "review_conversation"

两个阶段不得混合。

你可能会收到这些信息：
pin.coreIssue：当时保存的核心问题
pin.warmExplanation：当时的温柔解释
pin.reflectionDays：当时建议的回看天数
pin.currentGuides：此前给过的小建议，可能为空
pin.reviewHistory：此前回顾记录，可能为空
pin.reviewCount：回顾次数
pin.createdAt：创建时间
pin.reviewStage：当前阶段
pin.pendingReviewChoice：用户进入回顾前选择“会影响我”或“有一点影响”
messages / conversationHistory：本次回顾的聊天记录

如果字段名称略有不同，也要根据已有 pin 信息理解这根针原本记录的事情。

────────────────────
第一阶段：initial_review_analysis
────────────────────

当前用户已经表示，这根针现在仍然影响自己。

这个阶段的任务只有一个：
帮助用户说清楚，这件事为什么一直没有过去。

这一阶段不得分析原因，不得分类，不得给建议，不得推荐行动，不得推荐回顾时间，不得触发任何结束按钮。

你必须完成两件事：
承认这件事到现在仍然影响用户；
提出一个自然、综合性的诊断问题，让用户说明现在真正卡住自己的是什么。

不要复述、宣布或重新总结这根针原本记录的内容。coreIssue 只是帮助你理解背景，不是必须说给用户听的文字。直接延续对话，回应用户现在的状态。

在任何 review 阶段都不要使用或改写以下表达：
‘那根针记录的是’
‘这根针记录的是’
‘这根针里写的是’
‘你当时记录的是’
‘这件烦恼的核心是’
也不要用其他正式开场重新宣布 coreIssue。

问题要覆盖这些可能性，但不要写成问卷，也不要使用英文分类名：
后悔自己当时说了什么或做了什么；
事情后来继续发酵或变得更严重；
已经解释、道歉或采取行动，但没有得到回应；
一直没有采取行动，所以事情停在那里；
以上都不是，还有别的真正卡住的原因。

推荐问题结构：
“这件事到现在还是影响着你。你觉得自己一直放不下，更接近哪一种情况：是后悔当时说了什么或做了什么，后来事情变得更严重了，已经努力过却没有得到回应，还是一直没有采取行动，所以事情停在了那里？如果都不是，也可以告诉我真正卡住你的是什么。”

第一阶段只能有一个主要问题。不要继续追加第二个问题。不要说“今天发生了”或“刚刚发生了”。不要替用户判断真正原因。不要说“建议你”“下一步可以”“你可以试试”。不要推荐几天后回顾。

第一阶段必须固定输出：
{
  "reply": "中文回复，承认这件事仍然影响用户，并提出一个覆盖后悔、事情发酵、行动无回应、没有行动及其他原因的综合问题。",
  "readyToPin": false,
  "readyToRemove": false,
  "review": {
    "stillAffectsUser": true,
    "reasonCategory": "unclear",
    "nextReflectionDays": null
  }
}

第一阶段固定规则：
readyToPin 必须是 false。
readyToRemove 必须是 false。
review.stillAffectsUser 必须是 true。
review.reasonCategory 必须是 "unclear"。
review.nextReflectionDays 必须是 null。

────────────────────
第二阶段：review_conversation
────────────────────

用户已经回答了第一阶段的问题。现在你需要结合本次回答、聊天记录和此前建议，判断用户一直没有放下的主要原因。

任何 review 阶段都不要回顾或宣布原针记录，也不要复述 coreIssue。coreIssue、原始聊天和 reviewHistory 都只是背景知识。每次回复都直接回应用户最新输入的感受、问题或请求，让对话像同一次自然交流继续下去。

review_conversation 阶段不要过度使用 reasonCategory='unclear'。用户已经完成了第一阶段诊断后的第一次回复，所以即使回复比较短、模糊、只是说'好的'、'确实可以'、'还有一点难受'，也要尽量给出一个温和可执行的小步骤，并推荐一个 nextReflectionDays，让前端可以显示继续聊、几天后再看、取下针三个选择。

只有当用户输入完全无法理解、没有任何情绪或事件信息、或只是无意义字符时，才返回 reasonCategory='unclear' 且 nextReflectionDays=null。

对于模糊但可理解的 review 回复：
- 如果用户只是说仍然有点影响/还好/可能/确实可以：
  使用 reasonCategory='core_issue_unresolved'
  nextReflectionDays=5
  reply 应该说我们可能还不完全知道最深层的原因，但这个问题还有一些重量，所以让忧忧再替你收着5天，同时用户继续观察。
- 如果用户说需要更多时间：
  如果可能使用明确的分类，否则使用 core_issue_unresolved
  nextReflectionDays=5 或 7
- 如果用户提到受阻/恶化/关系改变：
  situation_worsened
  nextReflectionDays=14
- 如果用户说已经道歉/解释但没有得到回应：
  action_without_expected_response
  nextReflectionDays=7

当 nextReflectionDays 不为 null 时，reply 必须自然解释为什么是这个等待天数：事情较轻/中等/更严重/继续发酵/需要多一点时间沉下来。

reasonCategory 只能从以下七个值中选择：

regret_own_action
situation_worsened
core_issue_unresolved
no_next_action
action_without_expected_response
unclear
ready_to_release

第二阶段必须按照这个顺序回复：
先回应用户真正卡住的地方；
再用一句自然的话说明你判断到的原因；
如果原因明确但用户还受影响，只给一个现实中可以完成的小步骤；
最后自然说明建议几天后再回来看看。

不要编号，不要列表，不要一次给很多行动。一步就够。

────────────────────
前端按钮信号规则
────────────────────

AI 不直接生成按钮。AI 只通过 JSON 字段告诉前端该显示什么。

如果原因不清楚：
reasonCategory = "unclear"
nextReflectionDays = null
readyToRemove = false
前端不显示结束或回看按钮，保留输入框继续聊天。

如果原因已经明确，但用户还没有准备放下：
readyToRemove = false
reasonCategory = 对应类别
nextReflectionDays = 3、5、7、14 或 30
前端会显示继续聊天或稍后回看的按钮。

如果用户明确表达已经不影响自己、已经可以放下、可以取下、不用再回来了、感觉已经过去了：
readyToRemove = true
reasonCategory = "ready_to_release"
nextReflectionDays = null
前端会显示取下这根针的按钮。

不要在 reply 里硬写按钮文字。只要自然衔接即可，例如：
“先让忧忧再替你收着 7 天，到时候我们再看看它有没有变轻一点。”
或：
“如果你准备好了，就可以轻轻取下这根针。”

────────────────────
原因分类规则
────────────────────

regret_own_action：
适用于用户表达后悔当时说了重话、态度不好、没有解释清楚、处理得不好，或一直责怪自己。
回应方向：承认用户已经开始重新看见自己的选择，帮助用户区分“真正想表达的话”和“当时表达出来的方式”。
只给一个小步骤，例如：写下一句当时真正想说、但没有表达好的话。
如果未来要解释或道歉，要强调这是为了表达清楚，不是为了要求对方马上原谅或回应。
nextReflectionDays 建议：
- 用户已经开始反思：3-5天
- 用户还在纠结是否要道歉：5天
- 用户刚完成道歉/解释：7天（给对方回应时间）

situation_worsened：
适用于关系后来变僵、误会扩大、对方拉黑、争执升级、出现新的现实后果，事情已经和最初不一样。
回应方向：说明现在影响用户的已经包括后来发生的新变化。不要鼓励连续解释、重复联系或不断证明自己。
只给一个小步骤，例如：暂时停止重复联系，给彼此一点空间。
如果用户已经努力过，提醒用户不需要把所有结果都揽在自己身上。
nextReflectionDays 建议：
- 关系变僵但仍有沟通可能：7天
- 对方拉黑/拒绝沟通：14天
- 出现新的现实后果：14-30天

action_without_expected_response：
适用于用户已经解释、道歉、主动联系或努力修复，但对方没有回复、态度冷淡、没有给出期待中的回应。
回应方向：先肯定用户已经完成了自己能够控制的部分，再帮助用户看见：自己的行动可以表达态度，但不能决定别人如何回应。
只给一个小步骤，例如：把“我已经做过的”和“只能由对方决定的”分别写下来。
不要鼓励继续追问。
nextReflectionDays 建议：
- 刚尝试沟通但无回应：7天
- 多次尝试仍无回应：14天
- 决定不再主动：14-30天（给时间放下）

no_next_action：
适用于用户一直没有行动、不知道如何开始、一直拖着没有沟通、只是反复想，事情没有新的进展。
回应方向：说明情绪可能因为事情一直悬在那里而没有变化。
只给一个最容易完成的小步骤，例如：写下一段不发送的话，把自己真正想表达的内容整理出来。
如果 pin.currentGuides 里有用户还没尝试的建议，可以提醒用户先从上次那个最小的步骤开始。
nextReflectionDays 建议：
- 还在犹豫：3-5天
- 不知道如何开始：5天
- 一直拖延：7天（鼓励行动）

core_issue_unresolved：
适用于具体事情只是触发点，用户长期在意被重视、被理解、被尊重、被选择，或关系里的安全感；类似问题反复出现；事件过去了，但同一种不安还在。
回应方向：帮助用户看见这件事触碰到了一个持续存在的需要。不要诊断人格或依恋类型。
只给一个小步骤，例如：用一句话写下，在这段关系里自己最希望被理解的是什么。
nextReflectionDays 建议：
- 安全感/被认可等需求未满足：7-14天
- 类似问题反复出现：14天
- 长期存在的模式：14-30天

unclear：
适用于用户仍然只说“还是难受”“还是会想到”，没有回答综合问题，回答过于模糊，信息不足，或可能同时存在多种原因但无法判断主要原因。
此时不要强行分类，不要给建议，不要推荐回顾时间。
只提出一个更具体的问题，继续帮助用户说清楚原因。
输出必须是：
readyToRemove=false
reasonCategory="unclear"
nextReflectionDays=null

ready_to_release：
适用于用户明确说已经不影响自己、已经过去了、可以放下、可以取下、不用再回来了，或表达这件事现在已经明显变轻。
此时不要继续分析，也不要再推荐回顾时间。
回复要温柔承认这件事已经不像之前那样刺着用户，并允许用户取下这根针。
输出必须是：
readyToRemove=true
reasonCategory="ready_to_release"
nextReflectionDays=null
stillAffectsUser=false

────────────────────
回顾时间规则（基于 review 原因分类）
────────────────────

只有第二阶段，且 reasonCategory 不为 "unclear" 和 "ready_to_release" 时，才可以推荐下一次回顾时间。

nextReflectionDays 必须根据 reasonCategory 和用户当前状态综合判断：

regret_own_action（后悔自己的行为）：
- 用户已经开始反思：3-5天
- 用户还在纠结是否要道歉：5天
- 用户刚完成道歉/解释：7天（给对方回应时间）

situation_worsened（情况恶化）：
- 关系变僵但仍有沟通可能：7天
- 对方拉黑/拒绝沟通：14天
- 出现新的现实后果：14-30天

action_without_expected_response（行动未获回应）：
- 刚尝试沟通但无回应：7天
- 多次尝试仍无回应：14天
- 决定不再主动：14-30天（给时间放下）

no_next_action（没有下一步行动）：
- 还在犹豫：3-5天
- 不知道如何开始：5天
- 一直拖延：7天（鼓励行动）

core_issue_unresolved（核心问题未解决）：
- 安全感/被认可等需求未满足：7-14天
- 类似问题反复出现：14天
- 长期存在的模式：14-30天

通用判断要点：
- 用户情绪明显变轻：减少30%天数
- 用户情绪依然强烈：增加50%天数
- 用户需要完成一个具体步骤：以步骤所需时间为基础，至少5天
- 这是第2次及以上回顾：根据之前的变化调整（变化大则缩短，变化小则延长）
- 涉及他人回应：至少7天

表达要自然，例如：
“先让忧忧再替你收着 5 天，到时候我们再看看它有没有变轻一点。”
“可以把这根针再交给忧忧 7 天，这段时间先完成刚刚那个小步骤。”
“这件事后来发生了新的变化，先让忧忧替你保管 14 天，再回来看看它对你的影响有没有改变。”

不要说：
“系统判定”
“根据算法”
“你必须”
“你应该放下”
“你已经完全释怀”

────────────────────
第二阶段输出格式
────────────────────

原因明确但仍受影响：
{
  "reply": "中文回复，先回应用户卡住的地方，再说明判断到的原因，给一个实际可完成的小步骤，最后自然说明将这根针再交给忧忧几天。",
  "readyToPin": false,
  "readyToRemove": false,
  "reviewDays": 5,
  "review": {
    "stillAffectsUser": true,
    "reasonCategory": "对应类别",
    "nextReflectionDays": 5
  }
}

信息不足：
{
  "reply": "中文回复，只提出一个更具体的问题，继续帮助用户说明原因。",
  "readyToPin": false,
  "readyToRemove": false,
  "reviewDays": null,
  "review": {
    "stillAffectsUser": true,
    "reasonCategory": "unclear",
    "nextReflectionDays": null
  }
}

准备放下：
{
  "reply": "听起来这件事已经不像之前那样刺着你了。你不是把它强行忘掉，而是已经能带着更轻一点的心情继续往前走。如果你准备好了，就可以轻轻取下这根针。",
  "readyToPin": false,
  "readyToRemove": true,
  "reviewDays": null,
  "review": {
    "stillAffectsUser": false,
    "reasonCategory": "ready_to_release",
    "nextReflectionDays": null
  }
}

────────────────────
reviewDays 字段规则
────────────────────

reviewDays 是一个可选的顶层字段，用于动态控制前端显示的回顾天数。

使用规则：
1. 如果用户明确请求一个具体的天数（如"四天后"、"十五天后"），在回复同意后，将 reviewDays 设置为该精确数字。
2. 如果用户请求 AI 选择一个天数，根据对话内容选择一个合适的天数。
3. 如果对话不涉及改变回顾天数，reviewDays 可以为 null 或省略。
4. reviewDays 必须是一个正整数（1-365），不能是小数或零。
5. reply 文本和 reviewDays 的值必须一致。

示例：
用户："要不然四天后？"
AI 同意并回复："可以，那我们四天后再看看。"
输出：reviewDays: 4

用户："十五天后再看可以吗？"
AI 同意并回复："好的，那就十五天后再回来看看。"
输出：reviewDays: 15

用户："我觉得还需要再等一段时间"（没有给出具体数字）
AI 选择："可以，那我们7天后再看看。"
输出：reviewDays: 7

────────────────────
输出前自检
────────────────────

输出前确认：
JSON 是否完整且合法；
readyToPin 是否为 false；
第一阶段是否只问诊断问题，没有建议和时间；
第一阶段是否 reasonCategory="unclear" 且 nextReflectionDays=null；
第二阶段如果原因明确，是否给了一个小步骤和 nextReflectionDays；
第二阶段如果原因不清楚，是否没有建议、没有时间、继续提问；
如果 readyToRemove=true，reasonCategory 是否为 "ready_to_release" 且 nextReflectionDays=null；
如果 nextReflectionDays 不为 null，readyToRemove 是否为 false；
如果用户明确请求了具体天数，reviewDays 是否设置为该精确数字；
reviewDays 和 reply 文本中的天数是否一致。`;

function validateChatRequest(req) {
  const { mode, messages, pin } = req.body;
  
  if (!mode || (mode !== 'pinning' && mode !== 'review')) {
    return { valid: false, error: 'mode must be "pinning" or "review"' };
  }
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { valid: false, error: 'messages must be a non-empty array' };
  }
  
  for (const msg of messages) {
    if (!msg.role || (msg.role !== 'user' && msg.role !== 'assistant')) {
      return { valid: false, error: 'message role must be "user" or "assistant"' };
    }
    if (!msg.content || typeof msg.content !== 'string') {
      return { valid: false, error: 'message content must be a string' };
    }
  }
  
  return { valid: true };
}

const VALID_REASON_CATEGORIES = [
  'regret_own_action',
  'situation_worsened',
  'core_issue_unresolved',
  'no_next_action',
  'action_without_expected_response',
  'unclear',
  'ready_to_release'
];

function validateChatResponse(response) {
  if (!response || typeof response !== 'object') {
    return { valid: false, error: 'response is not an object' };
  }
  
  if (typeof response.reply !== 'string' || !response.reply.trim()) {
    return { valid: false, error: `reply is not a valid string (type: ${typeof response.reply}, value: "${String(response.reply || '').substring(0, 50)}")` };
  }
  
  if (typeof response.readyToPin !== 'boolean') {
    return { valid: false, error: `readyToPin is not a boolean (type: ${typeof response.readyToPin}, value: ${response.readyToPin})` };
  }
  
  if (typeof response.readyToRemove !== 'boolean') {
    return { valid: false, error: `readyToRemove is not a boolean (type: ${typeof response.readyToRemove}, value: ${response.readyToRemove})` };
  }
  
  if (response.analysis) {
    const analysis = response.analysis;
    if (typeof analysis !== 'object') {
      return { valid: false, error: `analysis is not an object (type: ${typeof analysis})` };
    }
    
    if (typeof analysis.coreIssue !== 'string' || !analysis.coreIssue.trim()) {
      return { valid: false, error: `analysis.coreIssue is not a valid string (type: ${typeof analysis.coreIssue}, value: "${String(analysis.coreIssue || '').substring(0, 50)}")` };
    }
    
    const reflectionDays = parseInt(analysis.reflectionDays);
    if (isNaN(reflectionDays) || reflectionDays < 1 || reflectionDays > 365) {
      return { valid: false, error: `analysis.reflectionDays is not a valid number (type: ${typeof analysis.reflectionDays}, value: ${analysis.reflectionDays})` };
    }
    
    if (typeof analysis.warmExplanation !== 'string') {
      return { valid: false, error: `analysis.warmExplanation is not a string (type: ${typeof analysis.warmExplanation})` };
    }
    
    if (!Array.isArray(analysis.currentGuides) || analysis.currentGuides.length !== 3) {
      return { valid: false, error: `analysis.currentGuides is not an array of 3 elements (type: ${typeof analysis.currentGuides}, length: ${Array.isArray(analysis.currentGuides) ? analysis.currentGuides.length : 'N/A'})` };
    }
    
    for (let i = 0; i < analysis.currentGuides.length; i++) {
      if (typeof analysis.currentGuides[i] !== 'string') {
        return { valid: false, error: `analysis.currentGuides[${i}] is not a string (type: ${typeof analysis.currentGuides[i]})` };
      }
    }
    
    if (typeof analysis.safe !== 'boolean') {
      return { valid: false, error: `analysis.safe is not a boolean (type: ${typeof analysis.safe}, value: ${analysis.safe})` };
    }
  }
  
  if (response.review) {
    const review = response.review;
    if (typeof review !== 'object') {
      return { valid: false, error: `review is not an object (type: ${typeof review})` };
    }
    
    if (typeof review.stillAffectsUser !== 'boolean') {
      return { valid: false, error: `review.stillAffectsUser is not a boolean (type: ${typeof review.stillAffectsUser}, value: ${review.stillAffectsUser})` };
    }
    
    if (typeof review.reasonCategory !== 'string' || !VALID_REASON_CATEGORIES.includes(review.reasonCategory)) {
      return { valid: false, error: `review.reasonCategory is invalid (value: "${review.reasonCategory}", valid options: ${VALID_REASON_CATEGORIES.join(', ')})` };
    }
    
    if (review.nextReflectionDays !== null) {
      const nextDays = parseInt(review.nextReflectionDays);
      if (isNaN(nextDays) || nextDays < 1 || nextDays > 365) {
        return { valid: false, error: `review.nextReflectionDays is not a valid number (type: ${typeof review.nextReflectionDays}, value: ${review.nextReflectionDays})` };
      }
    }
  }
  
  return { valid: true };
}

function extractResponsesOutputText(data) {
  let foundOutputText = false;
  let textContent = null;

  if (Array.isArray(data?.output)) {
    for (const outputItem of data.output) {
      if (outputItem?.type !== 'message' || !Array.isArray(outputItem.content)) {
        continue;
      }

      for (const contentItem of outputItem.content) {
        if (contentItem?.type === 'output_text' && typeof contentItem.text === 'string' && contentItem.text) {
          foundOutputText = true;
          textContent = contentItem.text;
          break;
        }
      }

      if (textContent) break;
    }
  }

  console.log('[DOUBAO CHAT] Responses parse output_text found:', foundOutputText);

  if (textContent) {
    return textContent;
  }

  console.warn('[DOUBAO CHAT] Responses API parse did not find output_text');
  return null;
}

function parseDoubaoContent(data, apiUrl) {
  if (apiUrl.includes('/responses')) {
    return extractResponsesOutputText(data);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    console.warn('[DOUBAO CHAT] Chat API parse did not find message content');
    return null;
  }
  return content;
}

function fallbackResponseForReason(mode, reason) {
  console.warn('[AI CHAT] Fallback reason:', reason);
  const fallback = { ...FALLBACK_RESPONSES[mode] };
  fallback.fallbackReason = reason;
  return fallback;
}

function buildDoubaoChatBody(apiKey, modelId, apiUrl, mode, messages, pin) {
  const systemPrompt = mode === 'review' ? REVIEW_SYSTEM_PROMPT : PINNING_SYSTEM_PROMPT;
  const systemMessage = {
    role: 'system',
    content: systemPrompt
  };

  const pinInfoMessage = pin ? {
    role: 'system',
    content: `当前针的信息：核心问题=${pin.coreIssue || '未分析'}，建议回看天数=${pin.reflectionDays || 0}，温柔解释=${pin.warmExplanation || '无'}，引导=${pin.currentGuides ? pin.currentGuides.join('；') : '无'}，AI分析结果=${JSON.stringify(pin.aiResult || {})}，回顾历史=${JSON.stringify(pin.reviewHistory || [])}，回顾次数=${pin.reviewCount || 0}，创建时间=${pin.createdAt ? new Date(pin.createdAt).toLocaleString('zh-CN') : '未知'}，模式=${mode}，reviewStage=${pin.reviewStage || '未设置'}，用户回顾选择=${pin.pendingReviewChoice || '未选择'}`
  } : null;

  const allMessages = [systemMessage];
  if (pinInfoMessage) {
    allMessages.push(pinInfoMessage);
  }
  allMessages.push(...messages);

  if (apiUrl.includes('/responses')) {
    return {
      model: modelId,
      input: allMessages.map(msg => ({
        role: msg.role,
        content: [{ type: 'input_text', text: msg.content }]
      }))
    };
  } else {
    return {
      model: modelId,
      input: allMessages.map(msg => ({
        role: msg.role,
        content: [{ type: 'input_text', text: msg.content }]
      }))
    };
  }
}

async function callDoubaoChat(mode, messages, pin) {
  const startTime = Date.now();
  const apiKey = process.env.DOUBAO_API_KEY;
  const modelId = process.env.DOUBAO_MODEL_ID;
  const apiUrl = process.env.DOUBAO_API_URL || DEFAULT_API_URL;

  const apiKeyPrefix = apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING';
  console.log('[DOUBAO CHAT] Endpoint:', apiUrl);
  console.log('[DOUBAO CHAT] Model:', modelId || 'MISSING');
  console.log('[DOUBAO CHAT] API key exists:', !!apiKey);
  console.log('[DOUBAO CHAT] API key prefix:', apiKeyPrefix);

  if (!apiKey || !modelId) {
    console.log('[DOUBAO CHAT] Elapsed:', Date.now() - startTime, 'ms');
    return fallbackResponseForReason(mode, 'missing_api_key_or_model_id');
  }

  const body = buildDoubaoChatBody(apiKey, modelId, apiUrl, mode, messages, pin);

  try {
    console.log('[DOUBAO CHAT] Calling API with body length:', JSON.stringify(body).length);
    console.log('[DOUBAO CHAT] Request body keys:', Object.keys(body));
    console.log('[DOUBAO CHAT] Timeout:', DOUBAO_TIMEOUT_MS, 'ms');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('[DOUBAO CHAT] Request timed out after', DOUBAO_TIMEOUT_MS, 'ms');
      controller.abort();
    }, DOUBAO_TIMEOUT_MS);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    console.log('[DOUBAO CHAT] Doubao response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.log('[DOUBAO CHAT] Elapsed:', Date.now() - startTime, 'ms');
      return fallbackResponseForReason(mode, `http_${response.status}:${errorBody.substring(0, 120)}`);
    }

    const data = await response.json();

    const content = parseDoubaoContent(data, apiUrl);

    if (!content) {
      console.log('[DOUBAO CHAT] Elapsed:', Date.now() - startTime, 'ms');
      return fallbackResponseForReason(mode, 'missing_output_text');
    }

    console.log('[DOUBAO CHAT] Extracted content length:', content.length);

    const parsedResponse = parseAndValidateResponse(content, mode);
    console.log('[DOUBAO CHAT] Elapsed:', Date.now() - startTime, 'ms');
    
    if (parsedResponse) {
      return parsedResponse;
    }

    return fallbackResponseForReason(mode, 'invalid_response_shape');

  } catch (error) {
    console.log('[DOUBAO CHAT] Elapsed:', Date.now() - startTime, 'ms');
    return fallbackResponseForReason(mode, `exception:${error.message}`);
  }
}



// Helper function to create fallback analysis for pinning mode
function createFallbackAnalysis(reply) {
  const coreIssue = extractCoreIssueFromText(reply);
  const reflectionDays = extractReflectionDaysFromText(reply) || 5;
  
  // Keep a non-empty coreIssue placeholder so validateChatResponse() doesn't reject
  // the entire response. The frontend will handle refining it in later responses.
  return {
    safe: true,
    coreIssue: coreIssue,
    reflectionDays: reflectionDays,
    warmExplanation: extractWarmExplanationFromText(reply),
    currentGuides: extractGuidesFromText(reply)
  };
}

function normalizeChatResponse(parsed, mode) {
  if (!parsed || typeof parsed !== 'object') return parsed;

  const normalized = { ...parsed };

  // Ensure reply is a string
  if (typeof normalized.reply !== 'string') {
    normalized.reply = String(normalized.reply || '');
  }
  normalized.reply = normalized.reply.trim();

  // Ensure readyToPin is boolean
  if (typeof normalized.readyToPin !== 'boolean') {
    normalized.readyToPin = String(normalized.readyToPin).toLowerCase() === 'true';
  }

  // Ensure readyToRemove is boolean
  if (typeof normalized.readyToRemove !== 'boolean') {
    normalized.readyToRemove = String(normalized.readyToRemove).toLowerCase() === 'true';
  }

  // Normalize analysis object
  if (normalized.analysis && typeof normalized.analysis === 'object') {
    normalized.analysis = { ...normalized.analysis };
    
    if (typeof normalized.analysis.coreIssue !== 'string') {
      normalized.analysis.coreIssue = String(normalized.analysis.coreIssue || '');
    }
    normalized.analysis.coreIssue = normalized.analysis.coreIssue.trim();
    
    // Validate coreIssue: if it appears to be conversational prose, contains ellipsis,
    // or is excessively long, replace with safe fallback
    const isPoorQualityTitle =
  !normalized.analysis.coreIssue ||
  normalized.analysis.coreIssue.includes('…') ||
  normalized.analysis.coreIssue.length > 40 ||
  normalized.analysis.coreIssue.includes('。') ||
  normalized.analysis.coreIssue.includes('！') ||
  normalized.analysis.coreIssue.includes('？');

if (isPoorQualityTitle) {
  console.warn(
    '[COREISSUE DEBUG] rejected coreIssue:',
    normalized.analysis.coreIssue
  );

  normalized.analysis.coreIssue =
    normalized.analysis.coreIssue || '这段还未完全放下的烦恼';
}
    // Convert reflectionDays to number if it's a string
    if (normalized.analysis.reflectionDays !== null && normalized.analysis.reflectionDays !== undefined) {
      const parsedDays = parseInt(normalized.analysis.reflectionDays, 10);
      normalized.analysis.reflectionDays = isNaN(parsedDays) ? 5 : parsedDays;
    }

    if (typeof normalized.analysis.warmExplanation !== 'string') {
      normalized.analysis.warmExplanation = String(normalized.analysis.warmExplanation || '');
    }
    normalized.analysis.warmExplanation = normalized.analysis.warmExplanation.trim();

    // Ensure currentGuides is an array of 3 strings
    if (!Array.isArray(normalized.analysis.currentGuides)) {
      normalized.analysis.currentGuides = ['', '', ''];
    } else {
      normalized.analysis.currentGuides = normalized.analysis.currentGuides.slice(0, 3);
      while (normalized.analysis.currentGuides.length < 3) {
        normalized.analysis.currentGuides.push('');
      }
      normalized.analysis.currentGuides = normalized.analysis.currentGuides.map(g => String(g || '').trim());
    }

    // Ensure safe is boolean
    if (typeof normalized.analysis.safe !== 'boolean') {
      normalized.analysis.safe = true;
    }
  } else if (mode === 'pinning') {
    // For pinning mode, always ensure analysis exists
    normalized.analysis = createFallbackAnalysis(normalized.reply || '');
    console.log('[AI CHAT] normalizeChatResponse - created fallback analysis for pinning mode');
  }

  // Normalize review object
  if (normalized.review && typeof normalized.review === 'object') {
    normalized.review = { ...normalized.review };

    if (typeof normalized.review.stillAffectsUser !== 'boolean') {
      normalized.review.stillAffectsUser = String(normalized.review.stillAffectsUser).toLowerCase() === 'true';
    }

    if (typeof normalized.review.reasonCategory !== 'string') {
      normalized.review.reasonCategory = 'unclear';
    }
    normalized.review.reasonCategory = normalized.review.reasonCategory.trim();

    // Convert nextReflectionDays to number if it's a string
    if (normalized.review.nextReflectionDays !== null && normalized.review.nextReflectionDays !== undefined) {
      const parsedDays = parseInt(normalized.review.nextReflectionDays, 10);
      normalized.review.nextReflectionDays = isNaN(parsedDays) ? null : parsedDays;
    }
  }

  // Handle top-level reviewDays field (takes precedence over review.nextReflectionDays)
  // This allows the AI to dynamically control the exact number of days
  if (normalized.reviewDays !== null && normalized.reviewDays !== undefined) {
    const parsedDays = parseInt(normalized.reviewDays, 10);
    if (!isNaN(parsedDays) && parsedDays > 0 && parsedDays <= 365) {
      normalized.reviewDays = parsedDays;
      // Also set in review object for backward compatibility
      if (!normalized.review) normalized.review = {};
      normalized.review.nextReflectionDays = parsedDays;
    } else {
      // Invalid value, remove it
      delete normalized.reviewDays;
    }
  }

  return normalized;
}

function detectReadyToPinFromText(text) {
  const lowerText = text.toLowerCase();
  
  const pinningKeywords = [
    '交给忧忧',
    '把这件事交给忧忧',
    '交给忧忧保管',
    '保存',
    '收好',
    '扎针',
    '这一针',
    '回看',
    '回顾',
    '如果觉得这个时间可以',
    '如果你觉得这个时间可以',
    '接受这个时间',
    '准备好了就告诉我',
    '你可以把这件事',
    '准备好就把',
    '帮你收好',
    '帮你保存',
    '天再回来看看',
    '天后再看看',
    '天后来看看'
  ];
  
  for (const keyword of pinningKeywords) {
    if (text.includes(keyword)) {
      return true;
    }
  }
  
  const hasReflectionTime = lowerText.includes('天') && 
    (lowerText.includes('后') || lowerText.includes('再') || lowerText.includes('回')) &&
    !lowerText.includes('今天') && !lowerText.includes('明天');
  
  const hasConfirmationRequest = text.includes('可以') && 
    (text.includes('吗') || text.includes('如果') || text.includes('就'));
  
  return hasReflectionTime && hasConfirmationRequest;
}

function detectReadyToRemoveFromText(text) {
  const lowerText = text.toLowerCase();
  
  const removalKeywords = [
    '放下',
    '取下',
    '拔掉',
    '拔掉这根针',
    '取下这根针',
    '轻轻取下',
    '已经过去了',
    '不再影响',
    '准备好了',
    '可以放下',
    '释然',
    '没有之前那么刺',
    '已经能带着更轻',
    '已经不像之前那样',
    '放下这根针',
    '准备好取下',
    '准备好放下',
    '不用再回来了',
    '不会再影响'
  ];
  
  for (const keyword of removalKeywords) {
    if (text.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

function extractReflectionDaysFromText(text) {
  const dayPatterns = [
    /(\d+)\s*天(后|再|回来|看看)/,
    /(\d+)\s*(个)?(日|天)/,
    /(三|五|七|十|十四|三十)\s*天/
  ];
  
  const chineseNumMap = {
    '三': 3,
    '五': 5,
    '七': 7,
    '十': 10,
    '十四': 14,
    '三十': 30
  };
  
  for (const pattern of dayPatterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1];
      if (chineseNumMap[numStr]) {
        return chineseNumMap[numStr];
      }
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num >= 1 && num <= 365) {
        return num;
      }
    }
  }
  
  return null;
}

function parseAndValidateResponse(content, mode) {
  if (!content) {
    console.warn('[AI CHAT] parseAndValidateResponse - content is empty/null');
    return null;
  }
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  
  if (jsonMatch) {
    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.warn('[AI CHAT] parseAndValidateResponse - JSON parse error:', e.message);
      console.warn('[AI CHAT] parseAndValidateResponse - matched string:', jsonMatch[0].substring(0, 200));
      return createPlainTextResponse(content, mode);
    }

    const normalized = normalizeChatResponse(parsed, mode);

    const validationResult = validateChatResponse(normalized);
    if (validationResult.valid) {
      console.log('[AI CHAT] JSON validated successfully');
      return normalized;
    }

    console.warn('[AI CHAT] parseAndValidateResponse - validation failed:', validationResult.error);
    console.warn('[AI CHAT] parseAndValidateResponse - normalized response:', JSON.stringify(normalized).substring(0, 500));
    return createPlainTextResponse(content, mode);
  }

  console.warn('[AI CHAT] parseAndValidateResponse - no JSON object found in content, using plain-text heuristics');
  console.warn('[AI CHAT] parseAndValidateResponse - first 200 chars:', content.substring(0, 200));
  
  return createPlainTextResponse(content, mode);
}

function extractCoreIssueFromText(text) {
  if (!text || typeof text !== 'string') {
    return '这段还未完全放下的烦恼';
  }
  
  // Only extract a title when the text contains an explicit short title marker
  // This prevents extracting conversational prose and truncating it with ellipsis
  
  // Look for explicit markers: "核心标题：..." or "coreIssue: ..."
  const titleMarkerPattern = /(?:核心标题|coreIssue)\s*[：:]\s*([^\n。！？；]{6,24})/;
  const match = text.match(titleMarkerPattern);
  
  if (match && match[1]) {
    const candidate = match[1].trim();
    
    // Validate: must be a concise title, no sentence-ending punctuation, no ellipsis
    if (!candidate.includes('…') && 
        !candidate.includes('。') && 
        !candidate.includes('！') && 
        !candidate.includes('？') &&
        !candidate.startsWith('你') &&
        candidate.length >= 6 && candidate.length <= 24) {
      return candidate;
    }
  }
  
  // If no explicit title marker found or candidate is invalid, return safe fallback
  // Do NOT extract from regular sentences - this produces poor quality truncated titles
  return '这段还未完全放下的烦恼';
}

function extractGuidesFromText(text) {
  const guides = [];
  
  // Try to find numbered or bulleted lists
  const listPattern = /(\d+[、.．])\s*([^。！？；\n]+)/g;
  let match;
  while ((match = listPattern.exec(text)) && guides.length < 3) {
    guides.push(match[2].trim());
  }
  
  // If no numbered list, try to find sentences that look like guides
  if (guides.length < 3) {
    const guideKeywords = ['可以', '不妨', '建议', '试着', '先', '如果', '你可以'];
    const sentences = text.split(/[。！？；\n]/).filter(s => s.trim().length > 0);
    
    for (const sentence of sentences) {
      if (guides.length >= 3) break;
      const trimmed = sentence.trim();
      if (guideKeywords.some(kw => trimmed.includes(kw)) && !trimmed.includes('天') && !trimmed.includes('回看')) {
        guides.push(trimmed);
      }
    }
  }
  
  // Fill remaining guides with defaults
  while (guides.length < 3) {
    const defaults = ['先慢慢呼一口气', '把这件事写完整', '今晚先不用急着解决'];
    guides.push(defaults[guides.length]);
  }
  
  return guides.slice(0, 3);
}

function extractWarmExplanationFromText(text) {
  const sentences = text.split(/[。！？；\n]/).filter(s => s.trim().length > 0);
  
  // Try to find a sentence that sounds like comfort/explanation
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.includes('疲惫') || trimmed.includes('难过') || trimmed.includes('难受') || 
        trimmed.includes('理解') || trimmed.includes('心情') || trimmed.includes('感受') ||
        trimmed.includes('时间') || trimmed.includes('慢慢来')) {
      return trimmed;
    }
  }
  
  return '我先帮你把这件事轻轻收好，等你准备好再回来看看。';
}

function createPlainTextResponse(content, mode) {
  const text = content.trim();
  
  const response = {
    reply: text,
    readyToPin: false,
    readyToRemove: false,
    debugFallback: false,
    fallbackReason: null
  };
  
  if (mode === 'pinning') {
    response.readyToPin = detectReadyToPinFromText(text);
    
    // Always generate analysis metadata from plain text to avoid separate API call
    // This ensures every pinning response includes analysis
    const reflectionDays = extractReflectionDaysFromText(text) || 5;
    
    response.analysis = {
      safe: true,
      coreIssue: extractCoreIssueFromText(text),
      reflectionDays: reflectionDays,
      warmExplanation: extractWarmExplanationFromText(text),
      currentGuides: extractGuidesFromText(text)
    };
    
    console.log('[AI CHAT] Plain-text pinning response - generated analysis from text');
    console.log('[AI CHAT] Plain-text pinning response - readyToPin:', response.readyToPin);
    console.log('[AI CHAT] Plain-text pinning response - analysis:', JSON.stringify(response.analysis));
  } else if (mode === 'review') {
    response.readyToRemove = detectReadyToRemoveFromText(text);
    
    if (response.readyToRemove) {
      response.review = {
        stillAffectsUser: false,
        reasonCategory: 'ready_to_release',
        nextReflectionDays: null
      };
    } else {
      const reflectionDays = extractReflectionDaysFromText(text);
      if (reflectionDays) {
        response.review = {
          stillAffectsUser: true,
          reasonCategory: 'unclear',
          nextReflectionDays: reflectionDays
        };
      }
    }
    
    console.log('[AI CHAT] Plain-text review response - readyToRemove:', response.readyToRemove);
  }
  
  return response;
}

function buildMinimaxChatBody(modelId, mode, messages, pin) {
  const systemPrompt = mode === 'review' ? REVIEW_SYSTEM_PROMPT : PINNING_SYSTEM_PROMPT;
  const systemMessage = {
    role: 'system',
    content: systemPrompt
  };

  const pinInfoMessage = pin ? {
    role: 'system',
    content: `当前针的信息：核心问题=${pin.coreIssue || '未分析'}，建议回看天数=${pin.reflectionDays || 0}，温柔解释=${pin.warmExplanation || '无'}，引导=${pin.currentGuides ? pin.currentGuides.join('；') : '无'}，AI分析结果=${JSON.stringify(pin.aiResult || {})}，回顾历史=${JSON.stringify(pin.reviewHistory || [])}，回顾次数=${pin.reviewCount || 0}，创建时间=${pin.createdAt ? new Date(pin.createdAt).toLocaleString('zh-CN') : '未知'}，模式=${mode}，reviewStage=${pin.reviewStage || '未设置'}，用户回顾选择=${pin.pendingReviewChoice || '未选择'}`
  } : null;

  const allMessages = [systemMessage];
  if (pinInfoMessage) {
    allMessages.push(pinInfoMessage);
  }
  allMessages.push(...messages);

  return {
    model: modelId,
    messages: allMessages,
    temperature: 0.4
  };
}

function getMinimaxApiKey() {
  return process.env.MINIMAX_API_KEY || 
         process.env.MINIMAX_KEY || 
         process.env.MINIMAX_TOKEN || 
         process.env.MINI_MAX_API_KEY;
}

async function callMinimaxChat(mode, messages, pin) {
  const startTime = Date.now();
  const apiKey = getMinimaxApiKey();
  const modelId = process.env.MINIMAX_MODEL_ID;
  const apiUrl = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com/v1';

  const apiKeyPrefix = apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING';
  console.log('[MINIMAX CHAT] Endpoint:', apiUrl);
  console.log('[MINIMAX CHAT] Model:', modelId || 'MISSING');
  console.log('[MINIMAX CHAT] API key exists:', !!apiKey);
  console.log('[MINIMAX CHAT] API key prefix:', apiKeyPrefix);

  if (!apiKey || !modelId) {
    console.log('[MINIMAX CHAT] Elapsed:', Date.now() - startTime, 'ms');
    return fallbackResponseForReason(mode, 'minimax_missing_api_key_or_model_id');
  }

  const body = buildMinimaxChatBody(modelId, mode, messages, pin);

  try {
    console.log('[MINIMAX CHAT] Calling API with body length:', JSON.stringify(body).length);
    console.log('[MINIMAX CHAT] Timeout:', MINIMAX_TIMEOUT_MS, 'ms');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('[MINIMAX CHAT] Request timed out after', MINIMAX_TIMEOUT_MS, 'ms');
      controller.abort();
    }, MINIMAX_TIMEOUT_MS);
    
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    console.log('[MINIMAX CHAT] Minimax response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.log('[MINIMAX CHAT] Elapsed:', Date.now() - startTime, 'ms');
      return fallbackResponseForReason(mode, `minimax_http_${response.status}:${errorBody.substring(0, 120)}`);
    }

    const data = await response.json();

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.log('[MINIMAX CHAT] Elapsed:', Date.now() - startTime, 'ms');
      return fallbackResponseForReason(mode, 'minimax_missing_content');
    }

    console.log('[MINIMAX CHAT] Raw content length:', content.length);

    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    const parsedResponse = parseAndValidateResponse(cleanContent, mode);
    console.log('[MINIMAX CHAT] Elapsed:', Date.now() - startTime, 'ms');
    
    if (parsedResponse) {
      return parsedResponse;
    }

    return fallbackResponseForReason(mode, 'minimax_invalid_response_shape');

  } catch (error) {
    console.log('[MINIMAX CHAT] Elapsed:', Date.now() - startTime, 'ms');
    return fallbackResponseForReason(mode, `minimax_exception:${error.message}`);
  }
}

async function callAIChatWithFallback(mode, messages, pin) {
  const provider = process.env.AI_PROVIDER || 'doubao';
  const fallbackProvider = process.env.AI_FALLBACK_PROVIDER || 'none';
  
  console.log('[AI CHAT] Selected provider:', provider);
  console.log('[AI CHAT] Fallback provider:', fallbackProvider);

  let result;
  let usedFallback = false;
  let retried = false;

  if (provider === 'minimax') {
    result = await callMinimaxChat(mode, messages, pin);
    
    if (!validateChatResponse(result).valid) {
      const isTimeoutError = result.fallbackReason && (
        result.fallbackReason.includes('timeout') || 
        result.fallbackReason.includes('AbortError') ||
        result.fallbackReason.includes('ECONN') ||
        result.fallbackReason.includes('Network')
      );
      
      if (isTimeoutError && !retried) {
        console.log('[AI CHAT] Minimax timeout/network error, retrying once');
        retried = true;
        result = await callMinimaxChat(mode, messages, pin);
      }
      
      if (!validateChatResponse(result).valid && fallbackProvider === 'doubao') {
        console.log('[AI CHAT] Minimax failed, falling back to Doubao');
        usedFallback = true;
        result = await callDoubaoChat(mode, messages, pin);
      }
    }
  } else {
    result = await callDoubaoChat(mode, messages, pin);
  }

  const validationResult = validateChatResponse(result);
  console.log('[AI CHAT] Provider:', provider, '| Used fallback:', usedFallback, '| Valid:', validationResult.valid);
  if (!validationResult.valid) {
    console.warn('[AI CHAT] Response validation error:', validationResult.error);
  }
  
  return { result, usedFallback, provider };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const validation = validateChatRequest(req);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { mode, messages, pin } = req.body;

  console.log('[AI CHAT] handler called with mode:', mode, 'messages count:', messages.length);

  const { result, usedFallback, provider } = await callAIChatWithFallback(mode, messages, pin);

  if (!validateChatResponse(result).valid) {
    console.warn('[AI CHAT] First attempt returned invalid response, retrying once');
    const retryResult = await callAIChatWithFallback(mode, messages, pin);
    if (validateChatResponse(retryResult.result).valid) {
      Object.assign(result, retryResult.result);
    }
  }

  if (!validateChatResponse(result).valid) {
    console.warn('[AI CHAT] Retry also failed, using fallback');
    Object.assign(result, fallbackResponseForReason(mode, 'retry_failed'));
  }

  if (result.review) {
    if (typeof result.review.nextReflectionDays === 'string') {
      const parsedDays = parseInt(result.review.nextReflectionDays);
      if (!isNaN(parsedDays)) {
        result.review.nextReflectionDays = parsedDays;
      }
    }
  }

  console.log('[AI CHAT] Final response - provider:', provider, '| usedFallback:', usedFallback);
  res.status(200).json(result);
}
