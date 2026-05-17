let userName = "John";
let passWord = "President2";

function login(typedUserName,typedPassWord) {
    if (typedUserName === userName && typedPassWord === passWord) {
        console.log("Login successful! Welcome," + typedUserName);
    } else {
        console.log("Wrong username or password. Try again!")
    }
}

function hidePassword(passWord) {
    let hidden = "";
    for (let i = 0; i < passWord.length; i++) {
        hidden = hidden + "*"
    }
    console.log("Your hidden password looks like this: " + hidden);
}

function changeUserName(newUserName) {
    userName = newUserName;
    console.log("Username has been changed to: " + userName);
}

function changePassWord(newPassWord) {
    passWord = newPassWord;
    console.log("Password has been changed to: " + newPassWord);
}

login("John", "President2");
hidePassword(passWord);
changeUserName("johnny1");
changePassWord("Ilovemangoes28.")
