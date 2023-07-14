import * as Misskey from 'misskey-js';
import * as dotenv from 'dotenv'
import fs from 'fs';
import axios from 'axios';
import cron from 'node-cron';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale/index.js';

dotenv.config();
const { MISSKEY_URL, TOKEN, DISCORD_WEBHOOK } = process.env;

const filename = 'lastid.txt';

const cli = new Misskey.api.APIClient(
    {
        origin: MISSKEY_URL,
        credential: TOKEN
    });

cron.schedule('* * * * *', () => {
    try {
        console.log('running a task...');
        checkAbuse();
    }
    catch (e) {
        console.log(e.message);
    }
});

const checkAbuse = async () => {
    const args = {}
    if (fs.existsSync(filename)) {
        const lastId = fs.readFileSync(filename).toString();
        console.log(lastId);
        if (lastId != '') {
            args.sinceId = lastId;
        }
    }

    await cli.request('admin/abuse-user-reports', args)
        .then(async arr => {
            const len = arr.length;

            if (len === 0) { return; }

            let res = arr;
            // 最新を0番目に。
            res.sort((a, b) => b.createdAt - a.createdAt);

            for (let i = len - 1; i--; i < 0) {
                const message = {
                    username: "Ikaskey Abuse Tracker",
                    content: "新しい通報を確認しました",
                    embeds: [
                        {
                            author: {
                                name: res[i].reporter.name,
                                url: MISSKEY_URL + '/@' + res[i].reporter.username,
                                icon_url: res[i].reporter.avatarUrl
                            },
                            title: "通報内容",
                            url: "https://ikaskey.bktsk.com/admin/abuses",
                            description: "以下の内容で通報がありました。",
                            color: 15925132,
                            "fields": [
                                {
                                    name: "対象ユーザー名",
                                    value: res[i].targetUser.name,
                                    inline: true
                                },
                                {
                                    name: "対象ユーザーID",
                                    value: "[@" + res[i].targetUser.username + "](" + MISSKEY_URL + "/@" + res[i].targetUser.username + ")",
                                    inline: true
                                },
                                {
                                    name: "通報内容",
                                    value: res[i].comment
                                },
                                {
                                    name: "通報日時",
                                    value: format(new Date(res[i].createdAt), 'PPPPpppp', { locale: ja })
                                }
                            ],
                            thumbnail: {
                                url: res[i].targetUser.avatarUrl
                            },
                            footer: {
                                text: "いかすきー",
                                icon_url: "https://ikaskey-s3.bktsk.com/ikaskey/a1a91699-6dbe-487d-adef-0e1e6442ef66.png"
                            }
                        }
                    ]
                };

                await axios.post(DISCORD_WEBHOOK, message).catch(e => console.log(e));
            }
            fs.writeFileSync(filename, res[0].id);
        })
        .catch(e => { console.error(e) });
}