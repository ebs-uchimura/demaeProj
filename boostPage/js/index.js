/**
 * index.js
 * メインJS
 */
 
$(function() {
  // スマホフラグ
  let spFlg = false;
  // ブロックコードCSV読込結果
  let globalBlockcodeArray = [];
  // インセンティブCSV読込結果
  let globalResultArray = [];
  
  // DOM設定
  const $area = $('select[id="area"]'); // エリア
  const $pref = $('select[id="prefecture"]'); // 都道府県
  const $city = $('select[id="city"]'); // 市区町村

  // 文字コードをShift-JISに変更
  $.ajaxSetup({
    beforeSend: function(xhr) {
      xhr.overrideMimeType('text/html;charset=Shift_JIS');
    }
  });

  // 767px以内ならtrue
  if (window.matchMedia('(max-width: 767px)').matches) {
    // スマホフラグON
    spFlg = true;
    // ヘッダ作成
    $("#resultmap #resulthead").append('<tr><th class="sp">ブロックコード</th><th class="sp">時間</th><th class="sp">インセンティブ</th></tr>');
  
  } else {
    // スマホフラグOFF
    spFlg = false;
    // ヘッダ作成
    $("#resultmap #resulthead").append('<tr><th class="pc">ブロックコード</th><th class="pc">0時</th><th class="pc">1時</th><th class="pc">2時</th><th class="pc">3時</th><th class="pc">4時</th><th class="pc">5時</th><th class="pc">6時</th><th class="pc">7時</th><th class="pc">8時</th><th class="pc">9時</th><th class="pc">10時</th><th class="pc">11時</th><th class="pc">12時</th><th class="pc">13時</th><th class="pc">14時</th><th class="pc">15時</th><th class="pc">16時</th><th class="pc">17時</th><th class="pc">18時</th><th class="pc">19時</th><th class="pc">20時</th><th class="pc">21時</th><th class="pc">22時</th><th class="pc">23時</th></tr>');
  }
  
  // テーブル初期化
  $("#resultmap #resultbody").empty();
  // 選択状態初期化
  $area.prop("selectedIndex", 0); // エリア
  $pref.prop("selectedIndex", 0); // 都道府県
  $city.prop("selectedIndex", 0); // 市区町村

  // ブロックコード読み込み
  getBlockcodeCSV().then(function(arr) {
    // グローバル格納
    globalBlockcodeArray = arr;
  });

  // 日本語にする
  $.datepicker.setDefaults($.datepicker.regional['ja']);

  // 日付カレンダー
  $("#datepicker").datepicker({
    dateFormat: 'yy-mm-dd', // 年月日
    duration: 'fast', // 高速
  });
  // 今日の日付が初期値
  $("#datepicker").datepicker("setDate", new Date()); 
  // 変更時
  $("#datepicker").datepicker().on('change', function() {
    try {
      // 都道府県
      const prefName = $pref.val();

      // 都道府県選択済
      if (prefName != '都道府県') {
        // 選択日付
        const tmpDate = $("#datepicker").val().replace(/-/g, '/');

        // 対象土曜日(選択日)
        extractDate(tmpDate).then(function(dayObj) {
          // 取得結果
          const gotResult = globalResultArray.filter(function(x) {
            return x.date == dayObj.month.start + dayObj.date.start;
          })[0];

          // 取得なしなら再取得
          if (gotResult === void 0) {
            // 実行
            startTabling(tmpDate).then(function() {
              console.log('table loaded.');
            });

          } else {
            console.log('same file');
            // 選択市区町村
            const cityName = $city.val();
            // テーブル初期化
            $("#resultmap #resultbody").empty();
            // 都道府県絞りデータ
            const dataPrefArray = gotResult.result.filter(function(x) {
              return judgePrefecture(x[0]) == prefName;
            });

            // スマートフォン
            if (spFlg) {
              console.log("spモード");
              // テーブル生成
              makeTBSp(dataPrefArray, tmpDate).then(function() {
                // 市区町村絞り
                cityHandler(cityName);
              });

            // PC
            } else {
              console.log("pcモード");
              // テーブル生成
              makeTB(dataPrefArray, tmpDate).then(function() {
                // 市区町村絞り
                cityHandler(cityName);
              });
            }
          }
        });
      }

    } catch(e) {
      // エラー表示
      console.log('1: ' + e);
    }
  });

  // エリア選択時
  $area.change(function() {
    try {
      // 選択エリア
      const areaName = $(this).val();
      // エリア検索
      $pref.find('option').each(function() {
        // 選択都道府県
        const prefName = $(this).data('val');

        // 選択都道府県と合致
        if (areaName === prefName) {
          // 表示
          $(this).show();

        } else {
          // 非表示
          $(this).hide();
        }
      });

    } catch(e) {
      // エラー表示
      console.log('2: ' + e);
    }
  });
  
  // 都道府県選択時
  $pref.change(function() {
    try {
      // 選択都道府県
      const prefName = $(this).val();
      // 選択日付
      const date = $("#datepicker").val();

      // 市区町村オプション初期化
      $city.empty();
      // 初期値代入
      $city.append('<option value="null" data-val="null">市区町村</option>');

      // マスタ都道府県抽出
      const masterPrefArray = globalBlockcodeArray.filter(function(x) {
        return x[1] === prefName;
      });

      // 市区町村入力
      masterPrefArray.forEach(function(pref) {
        // 市町村を追加
        $city.append('<option value=' + pref[2] + ' data-val=' + pref[1] + '>' + pref[2]  + '</option>');
      });

      // 実行
      startTabling(date).then(function() {
        console.log('table loaded.');
      });

    } catch(e) {
      // エラー表示
      console.log('3: ' + e);
    }
  });

  // 市町村選択時
  $city.change(function() {
    try {
      // 市区町村絞り
      cityHandler($(this).val());

    } catch(e) {
      // エラー表示
      console.log('4: ' + e);
    }
  });

  // * 汎用関数
  // CSV取得しテーブルへ格納
  function startTabling(date) {
    return new Promise(function(resolve, reject) {
      try {
        // 選択都道府県
        const prefName = $pref.val();
        // 選択市区町村
        const cityName = $city.val();
        // 取得結果
        const tmpDate = date.replace(/-/g, '/');
        // テーブル初期化
        $("#resultmap #resultbody").empty();

        // 対象土曜日
        extractDate(tmpDate).then(function(dayObj) {
          // CSV取得
          getIncentiveCSV(dayObj).then(function(arr) {
            // マスタ都道府県抽出
            const masterPrefArray = arr.filter(function(x) {
              return judgePrefecture(x[0]) === prefName;
            });

            // スマートフォン
            if (spFlg) {
              console.log("spモード");
              // テーブル生成
              makeTBSp(masterPrefArray, tmpDate).then(function() {
                // 市区町村絞り
                cityHandler(cityName);
              });

            // PC
            } else {
              console.log("pcモード");
              // テーブル生成
              makeTB(masterPrefArray, tmpDate).then(function() {
                // 市区町村絞り
                cityHandler(cityName);
              });
            }
          });
        });
        resolve();

      } catch(e) {
        // エラー表示
        console.log('5: ' + e);
        reject(e);
      }
    });
  }

  // テーブル作成関数
  function makeTB(arr, date) {
    return new Promise(function(resolve, reject) {
      try {
        // 初期化
        let counter = 0;

        // CSV全体ループ
        arr.forEach(function(val, i) {
          // 列数
          const j = i % 24;
          // 対象日付
          const tmpDate1 = val[1].replace(/-/g, '/').replace(/0/g, '');
          const tmpDate2 = date.replace(/-/g, '/').replace(/0/g, '');

          // 日付が一致
          if (tmpDate1 == tmpDate2) {
            // 行数
            const k = Math.floor(counter / 24 + 1);
            // id
            const tmpId = k + '-' + j;
            
            // 最初の行
            if (j == 0) { 
              // 行を追加
              $("#resultmap #resultbody").append('<tr class="row' + k + '">');
              // ブロックコード
              $(".row" + k).append('<td id="' + tmpId + '-1" class="pc">' + val[0] + '</td>');
            }
            
            // 列を追加
            $(".row" + k).append('<td id="' + tmpId + '-3" class="pc">' + val[3] + '</td>');

            // 23でリセット
            if (j == 23) {
              // 終了タグ
              $("#resultmap #resultbody").append('</tr>');
            }
            // カウントアップ
            counter++;
            // 着色
            makeBKColor($("#" + tmpId + "-3"));
          }
        });

        // 終了タグ
        $("#resultmap #resultmap").append('</table>');
        resolve();

      } catch(e) {
        // エラー表示
        console.log('6: ' + e);
        reject();
      }
    });
  }

  // テーブル作成関数
  function makeTBSp(arr, date) {
    return new Promise(function(resolve, reject) {
      try {
        // 初期化
        let counter = 0;

        // CSV全体ループ
        for (let i = 0; i < arr.length; i++) {
          // 列数
          const j = i % 24;
          // 対象日付
          const tmpDate1 = arr[i][1].replace(/-/g, '/').replace(/0/g, '');
          const tmpDate2 = date.replace(/-/g, '/').replace(/0/g, '');

          // 日付が一致
          if (tmpDate1 == tmpDate2) {
            // 行数
            const k = Math.floor(counter / 24 + 1);
            // id
            const tmpId = k + '-' + j;
            // 行を追加
            $("#resultmap #resultbody").append('<tr class="row' + counter + '">');
            // 列を追加
            $(".row" + counter).append('<td id="' + tmpId + '-1" class="sp">' + arr[i][0] + '</td>');
            $(".row" + counter).append('<td id="' + tmpId + '-2" class="sp">' + arr[i][2] + '時</td>');
            $(".row" + counter).append('<td id="' + tmpId + '-3" class="sp">' + arr[i][3] + '</td>');
            // 着色
            makeBKColor($("#" + tmpId + "-3"));
            // 終了タグ
            $("#resultmap #resultbody").append('</tr>');
            // カウントアップ
            counter++;
          }
        }
        // 終了タグ
        $("#resultmap #resultmap").append('</table>');
        resolve();

      } catch(e) {
        // エラー表示
        console.log('7: ' + e);
        reject();
      }
    });
  }

  // 市区町村ハンドラ
  function cityHandler(cityName) {
    
    // 市区町村選択済
    if (cityName != "null") {
      // マスタ市区町村抽出
      const masterCityArray = globalBlockcodeArray.filter(function(x) {
        return x[2] === cityName;
      })[0];

      // 取得ありのときのみ
      if (masterCityArray !== void 0) {
        // 表示・隠蔽
        displayandHide(masterCityArray[0], cityName);
      }

    } else {
      // 全表示
      showAllRow();
    }
  }

  // ブロックコードCSV取得関数
  function getBlockcodeCSV() {
    return new Promise(function(resolve, reject) {
      // ファイル名
      const targetFilename = './csv/DDM_boost_table.csv';
      console.log('reading: ' + targetFilename);

      // CSV取得
      $.ajax({
        url: targetFilename, // 対象URL

      }).done(function(data) {
        // CSVから配列へ
        const csv = $.csv.toArrays(data);
        // 配列を返す
        resolve(csv);

      }).fail(function(errorThrown) {
        // エラー
        console.log(errorThrown);

        // 404エラー表示
        if (errorThrown.status == 404) {
          displayNotFound(1);
        }
        reject();
      });
    });
  }

  // インセンティブCSV取得関数
  function getIncentiveCSV(dayObj) {
    return new Promise(function(resolve, reject) {
      // ファイル名
      const targetFilename = './csv/DDM_boost_' + dayObj.month.start + dayObj.date.start + '_' + dayObj.month.end  + dayObj.date.end + '.csv';
      console.log('reading: ' + targetFilename);

      // CSV取得
      $.ajax({
        url: targetFilename, // 対象URL

      }).done(function(data) {
        // CSVから配列へ
        const csv = $.csv.toArrays(data);
        // グローバル保持
        globalResultArray.push({
          'date': dayObj.month.start + dayObj.date.start, 
          'result': csv,
        });
        // 配列を返す
        resolve(csv);

      }).fail(function(errorThrown) {
        // エラー
        console.log(errorThrown);

        // 404エラー表示
        if (errorThrown.status == 404) {
          displayNotFound(2);
        }
        reject();
      });
    });
  }

  // セル色カラーリング
  function makeBKColor(elem) {
    try {
      // 色付け
      switch (elem.text()) {
        case '1':
        case '1.0':
          elem.css({'background-color': 'rgb(255, 228, 225)'});
          break;
        case '1.1':
          elem.css({'background-color': 'rgb(255, 213, 213)'});
          break;
        case '1.2':
          elem.css({'background-color': 'rgb(255, 170, 170)'});
          break;
        case '1.3':
        case '1.4':
          elem.css({'background-color': 'rgb(255, 128, 128)'});
          break;
        case '1.5':
        case '1.6':
          elem.css({'background-color': 'rgb(255, 85, 95)'});
          break;
        case '1.7':
        case '1.8':
          elem.css({'background-color': 'rgb(255, 43, 43)'});
          break;
        case '1.9':
        case '2.0':
        case '2':
        case '2.1':
        case '2.2':
        case '2.3':
        case '2.4':
        case '2.5':
          elem.css({'background-color': 'rgb(255, 0, 0)'});
          break;
      }

    } catch(e) {
      // エラー表示
      console.log('9: ' + e);
    }
  }

  // ブロックコード都道府県判定用関数
  function judgePrefecture(code) {
    try {
      // 都道府県判定用
      const tmpCode = ('00000'+ code).slice(-5);
      // インデックス
      const prefIndex = parseInt(tmpCode.slice(0, 2), 10) - 1;
      // 都道府県配列
      const prefArray = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];

      return prefArray[prefIndex];

    } catch(e) {
      // エラー表示
      console.log('10: ' + e);
    }
  }

  // 日付取得関数
  function extractDate(date) {
    return new Promise(function(resolve, reject) {
      try {
        // 土曜日
        let finalSaturDay;
        // 翌金曜日
        let finalNextFriDay;
        // 対象開始月
        let finalStartMonth;
        // 対象終了月
        let finalEndMonth;
        // 日付
        let tmpDate = new Date(date);
        // 土曜日基数
        const baseDayNum = 6;
        // 曜日No
        const dayNo = tmpDate.getDay();

        // 土曜日
        if (dayNo == baseDayNum) {
          // 直前土曜日
          finalSaturDay = tmpDate.getDate().toString();
          // 直前土曜日の月
          finalStartMonth = (tmpDate.getMonth() + 1).toString();
          // 直後金曜日セット
          tmpDate.setDate(tmpDate.getDate() + dayNo); 
          // 直後金曜日
          finalNextFriDay = tmpDate.getDate().toString();
          // 直後金曜日の月
          finalEndMonth = (tmpDate.getMonth() + 1).toString();

        // 日曜日-金曜日
        } else {
          // 対象日と直前土曜日の差分
          const dayDiff = dayNo - baseDayNum + 7;
          // 直前土曜日セット
          tmpDate.setDate(tmpDate.getDate() - dayDiff); 
          // 直前土曜日
          finalSaturDay = tmpDate.getDate().toString();
          // 直前土曜日の月
          finalStartMonth = (tmpDate.getMonth() + 1).toString();
          // 直後金曜日セット
          tmpDate.setDate(tmpDate.getDate() + tmpDate.getDay()); 
          // 直後金曜日
          finalNextFriDay = tmpDate.getDate().toString();
          // 直後金曜日の月
          finalEndMonth = (tmpDate.getMonth() + 1).toString();
        }

        // 結果
        resolve({
          'month': {
            'start': ('00'+ finalStartMonth).slice(-2), 
            'end': ('00'+ finalEndMonth).slice(-2),
           },
           'date': {
             'start': ('00'+ finalSaturDay).slice(-2),
             'end': ('00'+ finalNextFriDay).slice(-2),
           },
        });

      } catch (e) {
        // エラー表示
        console.log('10: ' + e);
        reject(e);
      }
    });
  }

  // 表示隠蔽関数
  function displayandHide(code, name) {
    try {
      // 全表示
      showAllRow();
      
      // コード取得済み
      if (code !== void 0) {
        // 最終コード
        const finalCode = ('00000'+ code).slice(-5);
        // 該当以外なら隠蔽
        hideUnnecessaryRow(finalCode);

      // 市区町村以外で該当データなし
      } else if (name != '市区町村') {
        // エラー表示
        displayNotFound(3);
      }
      console.log('table loaded.');

    } catch(e) {
      // エラー表示
      console.log('11: ' + e);
    }
  }

  // 不要行隠蔽関数
  function hideUnnecessaryRow(target) {
    try {
      // 非表示処理
      $('#resultbody tr td:nth-child(1)').each(function(i, elm) {
        // ブロックコード
        const finalCode = ('00000'+ $(elm).text()).slice(-5);

        // 該当の市町村以外なら
        if (finalCode != target) {
          // 隠す
          $(elm).parent().hide();

        } else {
          // 表示
          $(elm).parent().show();
        }
      });
      
    } catch(e) {
      // エラー表示
      console.log('12: ' + e);
    }
  }

  // 全表示関数
  function showAllRow() {
    try {
      // 非表示処理
      $('#resultbody tr').each(function(i, elm) {
        // 表示
        $(elm).show();
      });
      
    } catch(e) {
      // エラー表示
      console.log('13: ' + e);
    }
  }

  // 全隠蔽関数
  function hideAllRow() {
    try {
      // 非表示処理
      $('#resultbody tr').each(function(i, elm) {
        // 表示
        $(elm).hide();
      });
      
    } catch(e) {
      // エラー表示
      console.log('14: ' + e);
    }
  }

  // 404エラー表示関数
  function displayNotFound(no) {
    // colspan標準値
    let defColspan = 0;
    let defMessage = '';
    
    // スマートフォン
    if (spFlg) {
      defColspan = 3;

    // PC
    } else {
      defColspan = 25;
    }

    // テーブル全隠蔽
    hideAllRow();
    // 色付け
    switch (no) {
      case 1:
        defMessage = 'ブロックコードマスタの読み込みに失敗しました';
        break;
      case 2:
        defMessage = 'インセンティブデータの読み込みに失敗しました';
        break;
      case 3:
        defMessage = 'データが登録されていません';
        break;
    }
    // エラー表示
    $("#resultmap #resultbody").append('<tr class="error"><td colspan=' + defColspan + '>' + defMessage + '</tr>');
  }

});