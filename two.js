
import puppeteer from 'puppeteer-extra';

import StealthPlugin from 'puppeteer-extra-plugin-stealth'
puppeteer.use(StealthPlugin())


const registerIt = async (userData) => {
    // max amount to retry captcha if it fails
    const captchaRetryAllowed = 1;

    const logs = {}

    const browser = await puppeteer.launch({ headless: false })
    const page = await browser.newPage()
    const resp = await page.goto('https://pieraksts.mfa.gov.lv/en/cd/index')
    // const resp = await page.goto('https://pieraksts.mfa.gov.lv/en/uited-arab-emirates')

    const step1 = await page.evaluate(async (userData) => {
        const form = document.getElementById("mfa-form1")
        document.querySelector("#Persons\\[0\\]\\[first_name\\]").value = userData[0].firstName
        document.querySelector("#Persons\\[0\\]\\[last_name\\]").value = userData[0].lastName
        document.querySelector("#e_mail").value = userData[0].email
        document.querySelector("#e_mail_repeat").value = userData[0].email
        document.querySelector("#phone").value = userData[0].number
        // document.querySelector("#step1-next-btn > button").click()
    }, userData)

    for (let i = 1; i < userData.length; i++) {
        await page.click("#add-visitor > button > span.dot--blue > img")
        await page.evaluate((userData, i) => {
            document.querySelector(`#Persons\\[${i}\\]\\[first_name\\]`).value = userData[i].firstName
            document.querySelector(`#Persons\\[${i}\\]\\[last_name\\]`).value = userData[i].lastName
        }, userData, i)
    }
    logs.step1_detail_fillup = "OK"
    await page.click("#step1-next-btn > button")

    await sleep(1)

    // check if details are already submitted on given mail
    const errorExists = await page.evaluate(() => {
        const err = document.querySelector('.error.active');
        if (!!err) {
            return [!!err, err.innerHTML]
        } else {
            // no error occurs so err= false
            return false
        }
    });
    if (errorExists) {
        console.log(errorExists)
        browser.close()
        return { statusCode: 400, message: errorExists[1], logs }
    }

    const step2 = await page.evaluate(async (userData) => {
        for (let i = 0; i < userData.length; i++) {
            document.querySelector(`#mfa-form2 > div > div.dropdown > div:nth-child(${i + 1}) > section > div > div.form-services--title.js-services > p`).click()
            document.querySelector(`#${userData[i].service}`).checked = true
        }
        document.querySelector("#step2-next-btn > button").click()
    }, userData)

    logs.step2_choose_services = "OK"

    // await page.waitForNavigation({ waitUntil: 'networkidle0' });
    await sleep(1)

    // checks if dates are available
    const availableDates = await page.evaluate(() => {
        const activeDates = document.querySelectorAll(".cal-active"); // Get all elements with the class 'cal-active'
        const dates = [];

        Array.from(activeDates).map(date => {
            const dt = date.getAttribute("data-date");
            dates.push(dt);
            return dt;
        });
        return dates
    })
    console.log(availableDates)
    if (availableDates.length == 0) {
        console.log("not dates are avaiable")
        return { statusCode: 500, message: "No dates are available" }
    }
    console.log("selecting date..")
    // continue step 3 if dates are available
    const step3 = await page.evaluate(() => {
        const date = document.querySelector(`.cal-active`) //for the first avaialbe date
        date.click()
        setTimeout(() => {
            const nextBtn = document.querySelector("#step3-next-btn > button")
            if (nextBtn) {
                nextBtn.scrollIntoView()
                setTimeout(() => {
                    nextBtn.click()
                }, 500);
            }
        }, 500);
        return date.getAttribute("data-date")

    })
    logs.step3_choosing_date = `OK ${step3}`;
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    const doStep4 = async (counter) => {
        if (counter > captchaRetryAllowed)
            return "failed captcha invalid";

        await page.evaluate(async () => {
            document.querySelector("#notes_public").value = "testing"
            document.querySelector("#personal-data").checked = true
            document.querySelector("#mfa-form4 > div > div.btn-next-step--wrapper > button").click()
        })
        // console.log("final step:...")
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        // await page.screenshot({ path: "final.png" })
        const confirmation = await page.evaluate(() => {
            try {
                const success = document.querySelector("#success > p").innerHTML
                // const success = document.querySelector(".text--success").innerHTML
                return success
            } catch (err) {
                console.log('checking invalid code')
                const invalidCode = document.querySelector("#mfa-form4 > div > div.form-content--wrapper.margin-top-40 > div > fieldset:nth-child(2) > div.section-base.margin-bottom-30 > div > p").innerHTML
                if (invalidCode) {
                    return invalidCode
                }
            }
        })

        if (confirmation.includes("incorrect")) {
            logs.step4_captch_failed = `it failed, maxTry: ${captchaRetryAllowed}`
            doStep4(counter + 1);
        }
        return confirmation
    }
    const confirmation = await doStep4(0);

    browser.close()
    console.log(confirmation)
    return { statusCode: 200, message: confirmation, date: step3, logs }

}

const sleep = async (time) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(1)
        }, time * 1000)
    })
}


// console.log(registerIt(userData))

export { registerIt }