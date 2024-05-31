/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// 필요한 변수를 이곳에 선언 할 것

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// 함수를 아래에 exports.함수이름 방식으로 작성할 것

exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

exports.dataReceiver = functions.https.onRequest(async (request, response) => {
  try {
    const data = request.body; // 전송된 JSON 데이터
    // Firestore에 저장
    await admin.firestore().collection("powerData").add(data);
    response.status(200).send("Data received and stored successfully.");
  } catch (error) {
    console.error("Error storing data:", error);
    response.status(500).send("Error storing data.");
  }
});

exports.getDailyData = functions.https.onRequest(async (request, response) => {
  try {
    // Firestore에서 데이터 불러오기
    const powerDataCollection = admin.firestore().collection("powerData");
    const querySnapshot = await powerDataCollection.get();
    // 날짜별로 데이터 더하기
    const dailyData = {};
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const date = data.date; // 날짜 필드 이름에 맞게 수정
      const value = data.value; // 데이터 필드 이름에 맞게 수정
      if (!dailyData[date]) {
        dailyData[date] = 0;
      }
      dailyData[date] += value;
    });
    // powerData_daily 컬렉션에 저장
    const powerDataDailyCollection =
    admin.firestore().collection("powerData_daily");
    for (const date in dailyData) {
      if (Object.prototype.hasOwnProperty.call(dailyData, date)) {
        await powerDataDailyCollection.add({
          date,
          value: dailyData[date],
        });
      }
    }
  } catch (error) {
    console.error("Error storing data:", error);
    response.status(500).send("Error storing data.");
  }
});

exports.predictMonthlyData =
functions.https.onRequest(async (request, response) => {
  try {
    // powerData_daily 컬렉션에서 데이터 가져오기
    const powerDataDailyCollection =
    admin.firestore().collection("powerData_daily");
    const querySnapshot = await powerDataDailyCollection.get();
    let totalUsage = 0;
    let numDays = 0;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const value = data.value; // 데이터 필드 이름에 맞게 수정
      totalUsage += value;
      numDays++;
    });
    // 현재까지의 사용량 계산
    const dailyAverageUsage = totalUsage / numDays;
    // 한달 사용량 예상 계산
    const monthlyUsage = dailyAverageUsage * 30;
    console.log(`Daily average usage: ${dailyAverageUsage} kWh`);
    console.log(`Estimated monthly usage: ${monthlyUsage} kWh`);
  } catch (error) {
    console.error("Error storing data:", error);
    response.status(500).send("Error storing data.");
  }
});

exports.qLearning = onRequest(async (request, response) => {
  try {
    const numDays = 30; // 한 달 간의 일 수
    const maxUsage = 1000; // 최대 전력 사용량 가정
    const usageGoal = [200, 400, 1000]; // 누진구간 목표
    const rewards = [10, 5, -10]; // 각 누진구간에 따른 보상
    const alpha = 0.1; // 학습률
    const gamma = 0.9; // 할인율
    const epsilon = 0.1; // 탐험 비율
    // Firestore에서 Q-table 가져오기
    const qTableDoc =
    await admin.firestore().collection("qTable").doc("qValues").get();
    const Q = // let 사용 고려
    qTableDoc.exists ? qTableDoc.data().Q : Array(maxUsage + 1).fill().map(
        () => Array(numDays + 1).fill().map(
            () => Array(usageGoal.length).fill(0),
        ),
    );
    const actions = [-10, 0, 10]; // 에이전트
    const getReward = (currentUsage) => {
      for (let i = 0; i < usageGoal.length; i++) {
        if (currentUsage <= usageGoal[i]) {
          return rewards[i];
        }
      }
      return rewards[rewards.length - 1];
    };
    for (let episode = 0; episode < 1000; episode++) { // 에피소드 수
      let currentUsage = 0;
      for (let day = 0; day < numDays; day++) {
        // const state = [currentUsage, day];
        let action;
        if (Math.random() < epsilon) {
          action = actions[Math.floor(Math.random() * actions.length)];
        } else {
          action =
          actions[Q[currentUsage][day]
              .indexOf(Math.max(...Q[currentUsage][day]))];
        }
        let nextUsage = currentUsage + action;
        nextUsage = Math.max(0, Math.min(nextUsage, maxUsage));
        // const nextState = [nextUsage, day + 1];
        const reward = getReward(nextUsage);
        const bestNextAction = Math.max(...Q[nextUsage][day + 1]);
        Q[currentUsage][day][actions.indexOf(action)] =
        Q[currentUsage][day][actions.indexOf(action)] +
        alpha * (reward + gamma * bestNextAction -
        Q[currentUsage][day][actions.indexOf(action)]);
        currentUsage = nextUsage;
      }
    }
    // Firestore에 Q-table 저장
    await admin.firestore().collection("qTable").doc("qValues").set({Q});
    response.status(200).send("Q-table updated.");
  } catch (error) {
    console.error("Error storing data:", error);
    response.status(500).send("Error storing data.");
  }
});
