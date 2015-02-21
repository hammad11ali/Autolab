$(function() {

  /* Highlights lines longer than 80 characters autolab red color w*/
  var highlightLines = function(highlight) {
    $(".code").each(function() {
      var text = $(this).text();
      // To account for lines that have 80 characters and a line break
      var diff = text[text.length - 1] === "\n" ? 1 : 0;
      if(text.length - diff > 80 && highlight){
        $(this).css("background-color", "rgba(153, 0, 0, .9)");
        $(this).prev().css("background-color", "rgba(153, 0, 0, .9)");
      } else {
        $(this).css("background-color", "white");
        $(this).prev().css("background-color", "white");
      }
    });
  };
  $("#highlightLongLines").click(function(){
    highlightLines(this.checked);
  })

  /* following paths/functions for annotations */
  var path = '<%= course_assessment_submission_annotations_path(@course, @assessment, @submission) %>';
  var createPath = function(annotation) {
    return path + '.js';
  };
  var updatePath = function(annotation) {
    return path + '/' + annotation.attr('id').replace(/[^0-9]*/, '') + '.js';
  };
  var deletePath = updatePath;

  var problems = <%== @problems %>;

  var emptyAnnotation = "<%= annotation_text(nil) %>";

  var parseAnnotation = function(text) {
    /* IMPORTANT, this will only parse properly formatted input.
     * This is used to parse the input that has already been parsed
     * and changed by the server. Don't use it to parse input directly.*/
    if (text === emptyAnnotation) {
      return ["", "", ""];
    }
    if (text.indexOf("[") < 0) {
      return [text, "", ""];
    }
    var comment = rawToVisible(text.substring(0,text.indexOf('[')).trim());
    var valueProblem = text.match(/\[.*?\]/)[0];
    valueProblem = valueProblem.substring(1, valueProblem.length - 1);
    if (valueProblem.indexOf(":") < 0) /* no problem */ {
      return [comment, valueProblem, ""];
    }
    var value = valueProblem.split(":")[0];
    var problem = valueProblem.split(":")[1];

    return [comment.trim(), value.trim(), problem.trim()];
  }

  /* This function takes an annotation jQuery $(node) and turns it
   * into an annotated node with the proper id to identify it by later*/
  var setAnnotationTypeUpdate = function(annotation, id) {
    annotation.removeClass('createAnnotation')
        .addClass('updateAnnotation')
        .attr('id', 'annotation' + id);
    annotation.prev().text('\u00D7')
        .removeClass('createAnnotation')
        .addClass('deleteAnnotation');

    annotation.parent().addClass('annotated');
  }

  /* This is like the above function but it is called when an annotation
   * is deleted and resets it back to what it would be if it were
   * never annotated.
   */
  var resetAnnotationType = function(annotation) {

    var annotationId = annotation.attr('id').replace('annotation','');

    annotation.text(emptyAnnotation)
        .removeClass('updateAnnotation')
        .addClass('createAnnotation')
        .removeAttr('id');
    annotation.prev().text('+')
        .removeClass('deleteAnnotation')
        .addClass('createAnnotation');

    annotation.parent().removeClass('annotated');
    $('#li-annotation-'+annotationId).remove();
  }

  /* This function takes an annotation jquery node and
   * brings up three input boxes. 
   * One for each of: comment, value, problem.
   * 
   * Additionally, it sets the keydown functions for the inputs
   * so they submit on <Return> and the last one tabs back to
   * the first.
   * */
  var annotate = function(index, annotation) {

    annotation.parent().addClass("annotating");
    annotation.removeClass('syntaxError');

    var commentValueProblem = parseAnnotation(annotation.attr('name').trim());
    var comment = commentValueProblem[0];
    var value = commentValueProblem[1];
    var problem = commentValueProblem[2];

    var annotationForm = $(document.createElement('form'));
    annotationForm.addClass('inputForm');
    annotationForm.attr('title', '<Return> to submit');

    var commentInput = document.createElement('input');
    var valueInput = document.createElement('input');
    $(commentInput).addClass("comment").addClass("ui-widget-content");
    $(commentInput).attr('maxlength', '255');
    $(valueInput).addClass("value").addClass("ui-widget-content");
    commentInput.value = comment;
    valueInput.value = value;

    var problemInput = document.createElement('select');
    problemInput.innerHTML = "<option value=''>None</option>";
    var newOption = "";
    for (var i = 0; i < problems.length; i++) {
      newOption = "\n<option value='" + problems[i] + "'";
      if (problems[i] === problem) {
        newOption += " selected='selected'";
      }
      newOption += ">" + problems[i] + "</option>";
      problemInput.innerHTML = problemInput.innerHTML + newOption;
    }
    $(problemInput).addClass("problem").addClass("ui-widget-content");

    var commentLabel = document.createElement('text');
    commentLabel.innerHTML = "<span>Comment: </span>";
    var problemLabel = document.createElement('text');
    problemLabel.innerHTML = " Problem:";
    var valueLabel = document.createElement('text');
    valueLabel.innerHTML = "<span>Value: </span>";

    annotationForm.append(commentLabel);
    annotationForm.append(commentInput);
    annotationForm.append("<br />");
    annotationForm.append(valueLabel);
    annotationForm.append(valueInput);
    annotationForm.append(problemLabel);
    annotationForm.append(problemInput);

    /* submit on Return for all inputs */
    annotationForm.find("*").on('keydown', function (e) {
      if (e.keyCode === 13) { 
        cleanAndSubmit(); 
      }
    }); 

    /* submit on Return, and ignore tab so they don't get tabbed
           to the bottom of the screen */
    annotationForm.find(".problem").on('keydown', function (e) {
      if (e.keyCode === 13) { 
        cleanAndSubmit(); 
      }
      else if (e.keyCode === 9) { 
        /* tab in circles */
        $(this).parent().find(".comment").focus();
        e.preventDefault(); 
      }
    });

    annotation.empty();
    annotation.append(annotationForm);
    $(commentInput).focus();
  };

  /* first get the annotation, then set it's text to "Deleting...",
   * then use ajax to delete the annotation 
   * note: deleteAnnotation is only the little 'x' in the html */
  $(document).on('click', '.deleteAnnotation', function() {
    var annotation = $(this).next();
    annotation.text('Deleting...');
    annotation.removeClass('syntaxError');
    annotation.parent().removeClass('annotating');
    $.ajax({
      url: deletePath(annotation),
      type: 'DELETE',
      complete: function() {
        annotation.remove()
        resetAnnotationType(annotation);
      }
    });
    return false;
  });

  /* if you click a line, clean up any '.annotating's and
   * call annotate to set up the annotation.
   */
  $(document).on('click', '.line', function(e) {
    var annotation = $('.annotation', $(this));
    if (!annotation.parent().hasClass("annotating")) {
      cleanAndSubmit();
      annotate($(this).index(), annotation);
    }
    e.stopPropagation();
  });

  /* simple but important function. We get any node that
   * is being annotated and submit it's contents. 
   */
  var cleanAndSubmit = function() {
    var annotating = $('.annotating');
    if (annotating.length === 0) {
      return;
    }
    annotating.removeClass('annotating');

    doSubmit(annotating);

    annotating.find('form').remove();
  }

  /* sets up and calls $.ajax to submit an annotation */
  var doSubmit = function(node) {
    var annotation = $(node).find('.annotation');
    if (annotation.hasClass('createAnnotation')) {
      method = 'POST';
      resource = createPath(annotation);
    } else {
      method = 'PUT';
      resource = updatePath(annotation);
    }

    var text = getText(node);
    if (!text) { /* don't send empty form */
      annotation.html(emptyAnnotation);
      return;
    }
    annotation.html("Saving...");

    $.ajax({
      url: resource,
      accepts: "json",
      dataType: "json",
      data: {
        annotation: {
          submission_id: '<%= @submission.id %>',
          filename: '<%= @filename %>',
        <% if params[:header_position] %>
          position: <%= params[:header_position] %>,
        <% end %>
          line: $(node).index(),
          text: text,
          submitted_by: "<%= @cud.email %>"
        }
      },
      type: method,
      success: function (data, type) {
        setAnnotationTypeUpdate(annotation, data.id);
        storeLocal(annotation, data.text);
        if (isError(data.text)) {
          annotation.addClass('syntaxError');
        }
        else {
          var annStr = ['<li class="descript" id="li-annotation-'+data.id+'">line: ',
                        data.line,
                        ', ',
                        data.text,
                        '('+data.annotator+')</li>'].join('');
          $('#problem-list-' + data.problem).append(annStr);
        }
      },
      error: function (result, type) {
        console.log(result);
        console.log(type);
        annotation.html(emptyAnnotation)
      },
      complete : function(result, type) {}
    });
  }

  /* This function takes the contents of the 3 inputs and 
   * turns them into an annotation to be submitted to the server
   */
  var getText = function(node) {
    var form = node.find('form');
    var comment = form.find('.comment')[0].value;
    var problem = form.find('.problem')[0].value;
    var value = form.find('.value')[0].value;

    /* turn '[' to '\u01' and ']' to '\u02' */
    comment = visibleToRaw(comment);

    if (value) {
      if (problem) {
        return comment + "[" + value + ":" + problem + "]";
      } else {
        return comment + "[" + value + "]";
      }
    } else {
      if (problem) {
        return comment + "[?:" + problem + "]";
      }
    }
    return comment;
  }

  /* this is only called if a line is not clicked on */
  var onClick = function(e) {
    cleanAndSubmit();
  }

  /* did the server send back an error? */
  var isError = function(text) {
    var inComment = false;
    for (var i = 0; i < text.length; i++) {
      if (text[i] === '[') {
        inComment = true;
      } else if (text[i] === ']') {
        inComment = false;
      } else if (text[i] === '?' && inComment) {
        return true;
      }
    }
    return false;
  }

  /* Unfinished function which would replace reloading the annotations
   * by just refreshing the page.*/
  var scrapeAndUpdate = function() {
    var annotations = $('.annotation');
    for (var i = 0; i < annotations.length; i++) {
      if (annotations[i].innerHTML.trim() !== emptyAnnotation) {
        //do stuff
      }
    }
  }

  var storeLocal = function(node, text) {
    node.html(rawToVisible(text));
    node.attr('name', text);
  }

  var rawToVisible = function(text) {
    var result = "";
    for (var i = 0; i < text.length; i++) {
      if (text.charAt(i) === "\u0001") {
        result += "[";
      } else if (text.charAt(i) === "\u0002") {
        result += "]";
      } else {
        result += text.charAt(i);
      }
    }
    return result;
  }

  var visibleToRaw = function(text) {
    var result = "";
    for (var i = 0; i < text.length; i++) {
      if (text.charAt(i) === "[") {
        result += "\u0001";
      } else if (text.charAt(i) === "]") {
        result += "\u0002";
      } else {
        result += text.charAt(i);
      }
    }
    return result;
  }


  window.addEventListener('click', onClick, false);
});