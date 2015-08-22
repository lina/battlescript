angular.module('battlescript.battle', [])

.controller('BattleController', function($rootScope, $scope, $timeout, $location, $stateParams, Users, Battle, Collab, Editor) {
  $scope.username = Users.getAuthUser();

  ////////////////////////////////////////////////////////////
  // jQuery function
  ////////////////////////////////////////////////////////////
  jQuery(function($){

    $("#blurify__button").hover(function() {
      if($scope.totalPoints < 10) {
        $("#blurify__button").css('cursor','none');
      }
    });

    $("#jumblify__button").hover(function() {
      if($scope.totalPoints < 50) {
        $("#jumblify__button").css('cursor','none');
      }
    }); 

    $("#blurify__button").click(function() {
      if($scope.totalPoints>=10) {
        $scope.handleBlurifyEvents();
        Users.pointsChange($scope.user, -10); //blurify costs 10 points
        $scope.getStats($scope.username);
        return;
      } 
    });

    $("#jumblify__button").click(function() {
      if($scope.totalPoints>=50) {
        $scope.handleJumblifyEvents();
        Users.pointsChange($scope.user, -50); //blurify costs 10 points
        $scope.getStats($scope.username);
        return;
      } 
    });

    // FOR TESTING AND DEMO (maybe for deployed also)
    var secretCode = '';

    $("#swordnumber1").click(function() {
      secretCode+="one";
    });

    $("#swordnumber2").click(function() {
      secretCode+='two';
      if(secretCode === "onetwoonetwotwo") {
        Users.pointsChange($scope.user, 100);
        $scope.getStats($scope.username);        
      }
    });

  });

  ////////////////////////////////////////////////////////////
  // Displays insufficient point error message
  ////////////////////////////////////////////////////////////
  // $scope.displayPointsErrorMessage = function() {
  //   console.log('displayPointsErrorMessage executed');
  //   $rootScope.pointsErrorMessage = 'Not enough points!';    
  // }

  ////////////////////////////////////////////////////////////
  // fetch auth user and pass in info to directive
  ////////////////////////////////////////////////////////////

  $scope.user = Users.getAuthUser();
  $scope.userInfo = {username: $scope.user};
  $scope.avatar;

  ////////////////////////////////////////////////////////////
  // get user stats for dashboard
  ////////////////////////////////////////////////////////////

  $scope.getStats = function(username) {
    Users.getStats(username)
      .then(function(stats){
        $scope.currentStreak = stats.currentStreak;
        $scope.longestStreak = stats.longestStreak;
        $scope.totalWins = stats.totalWins;
        $scope.totalPoints = stats.totalPoints;
        $scope.avatar = stats.avatar;
        // console.log("$scope.avatar", $scope.avatar);
      });
  };

  $scope.getStats($scope.username);





  ////////////////////////////////////////////////////////////
  // set up spinner class and display it by default
  ////////////////////////////////////////////////////////////

  $scope.spinnerOn = true;

  ////////////////////////////////////////////////////////////
  // check first to see if valid battle room id
  ////////////////////////////////////////////////////////////

  $scope.battleRoomId = $stateParams.id;
  $scope.battleInitialized = false;

  Battle.isValidBattleRoom($scope.battleRoomId)
  .then(function(valid) {
    if (valid) {
      // if we have a valid battle room, then do this
      $rootScope.initBattleSocket($scope.battleRoomId, function() {
        // initialize battle socket events
        $scope.initBattle();
      });
    } else {
      // redirect to dashboard if battle id not valid
      $location.path('/dashboard');
    }
  })
  .catch(function(err) {
    console.log(err);
  });





  ////////////////////////////////////////////////////////////
  // set up user and opponent defaults
  ////////////////////////////////////////////////////////////

  // set up user states
  $scope.userReadyState = false;
  $scope.userReadyClass = '';
  $scope.userReadyText = 'Waiting on you';

  // set up opponent states
  $scope.opponentReadyState = false;
  $scope.opponentReadyClass = '';
  $scope.opponentReadyText = 'Waiting on opponent';





  ////////////////////////////////////////////////////////////
  // initialize the battle
  // 
  // this, importantly, needs to be set up here after the
  // battle socket itself has been initialized and set up
  // above.
  // 
  // unlike the updateUserReadyState function, this works
  // in tandem with the sockets. Hence, it needs to wait for
  // the socket to be initialized in the first place.
  ////////////////////////////////////////////////////////////

  $scope.initBattle = function() {
    // calls the function immediately, in case of refresh
    $scope.ifBothPlayersReady();

    // now listen for events
    $rootScope.battleSocket.on('opponentReady', function(opponent) {
      if ($scope.opponentReadyState === false) {
        $scope.opponentReadyState = true;
        $scope.opponentReadyClass = 'active';
        $scope.opponentReadyText = 'Ready for battle!';
        $scope.opponent = opponent;
        $scope.ifBothPlayersReady();
      } else {
        $scope.opponent = opponent;
        $scope.getOpponentAvatar();
      }
    });

    $rootScope.battleSocket.on('nameReq', function(){
      $rootScope.battleSocket.emit('nameSend', $scope.user);
    });
  };

  ///////////opponent avatar ///////////

  $scope.getOpponentAvatar = function() {
    Users.getStats($scope.opponent)
      .then(function(stats){

        // console.log("here are the stats for opponent avatar === ", stats);
        $scope.opponentAvatar = stats.avatar;
      });
     
  };

  

  ////////////////////////////////////////////////////////////
  // this updates the user's ready state depending on whether
  // they clicks the button
  ////////////////////////////////////////////////////////////

  $scope.updateUserReadyState = function() {
    if ($scope.userReadyState === false) {
      $scope.userReadyState = true;
      $scope.userReadyClass = 'active';
      $scope.userReadyText = 'Ready for battle!';
      $rootScope.battleSocket.emit('userReady', $scope.user);
      $scope.ifBothPlayersReady();
    }
  };




  ////////////////////////////////////////////////////////////
  // checks if both players ready
  // 
  // this gets called each time a user clicks a "ready state"
  // button.
  ////////////////////////////////////////////////////////////
  
  $scope.ifBothPlayersReady = function() {
    if ($scope.userReadyState && $scope.opponentReadyState || window.localStorage.getItem('battleInitiated-' + $scope.battleRoomId)) {

      // If battle has already been initiated, set user and opponent ready state to true
      // so that waiting screen will not show
      if (window.localStorage.getItem('battleInitiated-' + $scope.battleRoomId)){
        $scope.userReadyState = true;
        $scope.opponentReadyState = true;
        $rootScope.battleSocket.emit('getOpponent');
      } else {
        // Save battle initiated to local storage: this will allow battle to reload automatically
        // if user refreshes page, or comes back to battle after leaving accidentally
        window.localStorage.setItem('battleInitiated-' + $scope.battleRoomId, true);
      }
      
      $scope.setUpBattle();
    } else {
      // show the battle waiting area
      $scope.spinnerOn = false;
      $scope.showBattleWaitingArea = true;
      if (!$scope.$$phase) $scope.$apply();
    }
  };
  




  ////////////////////////////////////////////////////////////
  // set up the battle here
  ////////////////////////////////////////////////////////////

  $scope.setUpBattle = function() {
    $scope.spinnerOn = true;
    if (!$scope.$$phase) $scope.$apply();
    
    // set up both editors
    $scope.userEditor = Editor.makeEditor('#editor--user', false, 0);
    $scope.opponentEditor = Editor.makeEditor('#editor--opponent', true, 0);
    $scope.handleEditorEvents();

    // set up various fields
    $scope.userButtonAttempt = 'Attempt Solution';
    $scope.userNotes = 'Nothing to show yet...';

    // get the battle
    $scope.getBattle();
  };

  ////////////////////////////////////////////////////////////
  // handle power(jumblify) events
  ////////////////////////////////////////////////////////////
  $scope.handleJumblifyEvents = function() {
    $rootScope.battleSocket.emit('powerJumblifySent');      
  };

  $scope.handleJumblifyReceiveEvents = function() {

    $rootScope.battleSocket.on('powerJumblifyReceived', function() {
      var cursorPosition = document.getElementsByTagName('input').selectionStart;

      var currentTextareaValue = $scope.userEditor.getValue();
      var length = currentTextareaValue.length;
      var index1 = length / 3;
      var index2 = length / 3 * 2;
      var textChunk1 = currentTextareaValue.slice(0,index1);
      var textChunk2 = currentTextareaValue.slice(index1,index2);
      var textChunk3 = currentTextareaValue.slice(index2,length);

      var generateRandomNumber = Math.random();
      if(generateRandomNumber < 0.33) {
        $scope.userEditor.setValue(textChunk1 + _.shuffle(textChunk2.split('')).join('') + textChunk3);
      } else if (generateRandomNumber < 0.66) {
        $scope.userEditor.setValue(textChunk1 + textChunk2 + _.shuffle(textChunk3.split('')).join(''));            
      } else {
        $scope.userEditor.setValue(_.shuffle(textChunk1.split('')).join('') + textChunk2 + textChunk3);            
      }
    });
  };





  ////////////////////////////////////////////////////////////
  // handle power(blurify) events
  ////////////////////////////////////////////////////////////
  $scope.handleBlurifyEvents = function() {
    $rootScope.battleSocket.emit('powerBlurifySent');      
  };

  $scope.handleBlurifyReceiveEvents = function() {
    $rootScope.battleSocket.on('powerBlurifyReceived', function() {
        jQuery(function($){
          $('.blurify__overlay').css('display','inline');
          $('.blurify__overlay').css("opacity","0.85");
          $('.blurify__overlay').fadeIn( 2000 ).delay( 5000 ).slideUp( 400 );
        });
    });
  };





  ////////////////////////////////////////////////////////////
  // handle editor events
  ////////////////////////////////////////////////////////////

  $scope.handleEditorEvents = function() {
    $scope.userEditor.on('change', function(e) {
      $rootScope.battleSocket.emit('userTextChange', $scope.userEditor.getValue());
    });

    $rootScope.battleSocket.on('updateOpponent', function(text){
      $scope.opponentEditor.setValue(text);
    });
  };





  ////////////////////////////////////////////////////////////
  // get the battle, get ready for showdown!
  ////////////////////////////////////////////////////////////
  
  $scope.getBattle = function() {
    // first, cache some vars
    $scope.battle;
    $scope.battleDescription = null;
    $scope.battleProjectId = null;
    $scope.battleSolutionId = null;

    // fetch a battle
    Battle.getBattle($scope.battleRoomId)
    .then(function(data) {
      // display the battle field
      $scope.displayBattleField();

      // set up the battle specifics
      $scope.battle = JSON.parse(data.body);
      $scope.battleDescription = marked($scope.battle.description);
      $scope.battleProjectId = $scope.battle.session.projectId;
      $scope.battleSolutionId = $scope.battle.session.solutionId;

      // update editors
      $timeout(function() {
        $scope.userEditor.setValue($scope.battle.session.setup);
        $scope.opponentEditor.setValue($scope.battle.session.setup);
        $scope.$apply();
      }, 50);

    })
    .catch(function(err) {
      console.log('There was an error fetching the problem...');
      console.log(err);
    });
  };





  ////////////////////////////////////////////////////////////
  // display the battle field
  ////////////////////////////////////////////////////////////

  $scope.displayBattleField = function() {
    // hide the spinner, hide the waiting area, and show the battle field
    $scope.spinnerOn = false;
    $scope.showBattleWaitingArea = false;
    $scope.battleFieldClass = 'active';

    // handle battle field events
    $scope.handleBattleFieldEvents();
    $scope.handleBlurifyReceiveEvents();
    $scope.handleJumblifyReceiveEvents();
  };





  ////////////////////////////////////////////////////////////
  // handle battle events
  ////////////////////////////////////////////////////////////

  $scope.handleBattleFieldEvents = function() {
    $rootScope.battleSocket.on('opponentWon', function(){
      // Any negative is regarded as a loss. 
      Users.statChange($scope.user, -1);
      Users.pointsChange($scope.user, 1); //users get one point for every game they play but lost

      // alert to the user!
      alert('Looks like your opponent got the answer first!');

      //redirect back. winner found
      $location.path('/dashboard'); 
    });
  };
  







  ////////////////////////////////////////////////////////////
  // handle battle attempts
  ////////////////////////////////////////////////////////////

  $scope.attemptBattle = function($event) {
    $event.preventDefault();

    $scope.userButtonAttempt = 'Attempting...';

    Battle.attemptBattle($scope.battleProjectId, $scope.battleSolutionId, $scope.userEditor.getValue())
      .then(function(data) {
        $scope.userButtonAttempt = 'Attempt Solution';
        $scope.userNotes = data.reason;

        // TODO: polling is successful at this point in time, time to send
        // and recieve the correct data
        console.log(data);
        if (data['passed'] === true) {
          Users.statChange($scope.user, 1); // # of times to increase the wins. Should be 1 always
          Users.pointsChange($scope.user, 10); //users get 10 points for every game they win

          $rootScope.battleSocket.emit('winnerFound');
          $scope.userNotes = "All tests passing!";
          alert('You have the answer. Good job!');
          $location.path('/dashboard'); //redirect back. winner found
        }
      });
  };

});
