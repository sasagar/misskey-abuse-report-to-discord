import * as Misskey from 'misskey-js';
import * as dotenv from 'dotenv'
import fs from 'fs';
import axios from 'axios';
import cron from 'node-cron';
// import { format } from 'date-fns';
import { ja } from 'date-fns/locale/index.js';
import { utcToZonedTime, format as formatTZ } from 'date-fns-tz';

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
        const lastId = fs.readFileSync(filename).toString().replace(/\r?\n/g, '');
        console.log(lastId);
        if (lastId != '') {
            args.sinceId = lastId;
        }
    }

    await cli.request('admin/abuse-user-reports', args)
        .then(async arr => {
            const len = arr.length;

            // 0件ならスルー
            if (len === 0) { return; }

            let res = arr;
            if (len >= 2) {
                // 最新を最後に。
                res.sort((a, b) => a.createdAt - b.createdAt);
            }

            for (let i = 0; i < len; i++) {
                // Timezone collection
                const utcDate = new Date(res[i].createdAt);
                //=> 2000-01-01T00:00:00.000Z
                const jstDate = utcToZonedTime(utcDate, 'Asia/Tokyo');
                //=> 2000-01-01T09:00:00.000Z
                const jstString = formatTZ(jstDate, 'PPP(EEE) HH:mm:ss (xxx)', { locale: ja, timeZone: 'Asia/Tokyo' });
                //=> "2000-01-01 09:00:00"

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
                                    value: jstString,
                                },
                                {
                                    name: "通報id",
                                    value: res[i].id,
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
                console.log(message);
                await axios.post(DISCORD_WEBHOOK, message).catch(e => console.log(e));
            }
            fs.writeFileSync(filename, res[len - 1].id);
        })
        .catch(e => { console.error(e) });
}

checkAbuse();